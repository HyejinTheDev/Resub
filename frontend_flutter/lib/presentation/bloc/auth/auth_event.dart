import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AppStartedEvent extends AuthEvent {}

class LoginRequestedEvent extends AuthEvent {
  final String username;
  final String password;

  const LoginRequestedEvent({required this.username, required this.password});

  @override
  List<Object?> get props => [username, password];
}

class RegisterRequestedEvent extends AuthEvent {
  final String username;
  final String email;
  final String password;

  const RegisterRequestedEvent({
    required this.username,
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [username, email, password];
}

class VerifyOtpRequestedEvent extends AuthEvent {
  final String email;
  final String otpCode;

  const VerifyOtpRequestedEvent({required this.email, required this.otpCode});

  @override
  List<Object?> get props => [email, otpCode];
}

class ResendOtpRequestedEvent extends AuthEvent {
  final String email;

  const ResendOtpRequestedEvent({required this.email});

  @override
  List<Object?> get props => [email];
}

class GoogleLoginRequestedEvent extends AuthEvent {
  final String credential;

  const GoogleLoginRequestedEvent({required this.credential});

  @override
  List<Object?> get props => [credential];
}

class LogoutRequestedEvent extends AuthEvent {}

class RefreshProfileEvent extends AuthEvent {
  final String userId;

  const RefreshProfileEvent({required this.userId});

  @override
  List<Object?> get props => [userId];
}

class UpgradeToProEvent extends AuthEvent {
  final String userId;

  const UpgradeToProEvent({required this.userId});

  @override
  List<Object?> get props => [userId];
}
