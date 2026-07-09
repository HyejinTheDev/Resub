import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../domain/repositories/auth_repository.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository authRepository;

  AuthBloc({required this.authRepository}) : super(AuthInitial()) {
    on<AppStartedEvent>(_onAppStarted);
    on<LoginRequestedEvent>(_onLoginRequested);
    on<RegisterRequestedEvent>(_onRegisterRequested);
    on<VerifyOtpRequestedEvent>(_onVerifyOtpRequested);
    on<ResendOtpRequestedEvent>(_onResendOtpRequested);
    on<GoogleLoginRequestedEvent>(_onGoogleLoginRequested);
    on<LogoutRequestedEvent>(_onLogoutRequested);
  }

  Future<void> _onAppStarted(AppStartedEvent event, Emitter<AuthState> emit) async {
    try {
      final user = await authRepository.getCachedUser();
      if (user != null) {
        emit(Authenticated(user));
      } else {
        emit(Unauthenticated());
      }
    } catch (_) {
      emit(Unauthenticated());
    }
  }

  Future<void> _onLoginRequested(LoginRequestedEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await authRepository.login(event.username, event.password);
      emit(Authenticated(user));
    } catch (e) {
      final String errorStr = e.toString().replaceAll('Exception: ', '');
      if (errorStr.startsWith('OTP_PENDING:')) {
        final parts = errorStr.split(':');
        final email = parts[1];
        final msg = parts.sublist(2).join(':');
        emit(AuthOtpPending(email: email, message: msg));
      } else {
        emit(AuthFailure(errorStr));
      }
    }
  }

  Future<void> _onRegisterRequested(RegisterRequestedEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final result = await authRepository.register(
        username: event.username,
        email: event.email,
        password: event.password,
      );
      emit(AuthOtpPending(
        email: result['email'] ?? event.email,
        message: result['message'] ?? 'Vui lòng nhập mã OTP để kích hoạt tài khoản!',
      ));
    } catch (e) {
      emit(AuthFailure(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> _onVerifyOtpRequested(VerifyOtpRequestedEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await authRepository.verifyOtp(event.email, event.otpCode);
      emit(Authenticated(user));
    } catch (e) {
      emit(AuthFailure(e.toString().replaceAll('Exception: ', '')));
      emit(AuthOtpPending(email: event.email));
    }
  }

  Future<void> _onResendOtpRequested(ResendOtpRequestedEvent event, Emitter<AuthState> emit) async {
    try {
      await authRepository.resendOtp(event.email);
      emit(AuthOtpPending(
        email: event.email,
        message: 'Mã xác thực mới đã được gửi lại thành công!',
      ));
    } catch (e) {
      emit(AuthFailure(e.toString().replaceAll('Exception: ', '')));
      emit(AuthOtpPending(email: event.email));
    }
  }

  Future<void> _onGoogleLoginRequested(GoogleLoginRequestedEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await authRepository.loginWithGoogle(event.credential);
      emit(Authenticated(user));
    } catch (e) {
      emit(AuthFailure(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> _onLogoutRequested(LogoutRequestedEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    await authRepository.logout();
    emit(Unauthenticated());
  }
}
