import 'dart:async';
import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../core/constants/colors.dart';
import '../../bloc/auth/auth_bloc.dart';
import '../../bloc/auth/auth_event.dart';
import '../../bloc/auth/auth_state.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();
  final TextEditingController _otpController = TextEditingController();
  
  bool _isLogin = true;
  String _errorMessage = '';
  String _successMessage = '';
  String _otpEmail = '';
  
  Timer? _countdownTimer;
  int _secondsRemaining = 0;

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _otpController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    setState(() {
      _secondsRemaining = 60;
    });
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() {
          _secondsRemaining--;
        });
      } else {
        _countdownTimer?.cancel();
      }
    });
  }

  void _submit() {
    setState(() {
      _errorMessage = '';
      _successMessage = '';
    });

    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();
    final email = _emailController.text.trim();
    final confirmPassword = _confirmPasswordController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!';
      });
      return;
    }

    if (!_isLogin) {
      if (email.isEmpty) {
        setState(() {
          _errorMessage = 'Vui lòng nhập địa chỉ email!';
        });
        return;
      }
      if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email)) {
        setState(() {
          _errorMessage = 'Địa chỉ email không đúng định dạng!';
        });
        return;
      }
      if (password != confirmPassword) {
        setState(() {
          _errorMessage = 'Mật khẩu nhập lại không trùng khớp!';
        });
        return;
      }
    }

    if (_isLogin) {
      context.read<AuthBloc>().add(LoginRequestedEvent(
            username: username,
            password: password,
          ));
    } else {
      context.read<AuthBloc>().add(RegisterRequestedEvent(
            username: username,
            email: email,
            password: password,
          ));
    }
  }

  void _submitOtp() {
    setState(() {
      _errorMessage = '';
      _successMessage = '';
    });

    final otpCode = _otpController.text.trim();
    if (otpCode.length != 6) {
      setState(() {
        _errorMessage = 'Mã xác thực OTP phải gồm 6 chữ số!';
      });
      return;
    }

    context.read<AuthBloc>().add(VerifyOtpRequestedEvent(
          email: _otpEmail,
          otpCode: otpCode,
        ));
  }

  void _resendOtp() {
    if (_secondsRemaining > 0) return;
    
    context.read<AuthBloc>().add(ResendOtpRequestedEvent(
          email: _otpEmail,
        ));
    _startCountdown();
  }

  Future<void> _loginWithGoogle() async {
    setState(() {
      _errorMessage = '';
      _successMessage = '';
    });
    
    try {
      final clientId = await context.read<AuthBloc>().authRepository.getGoogleClientId();
      if (clientId == null) {
        throw Exception('Không lấy được cấu hình Google Client ID từ máy chủ.');
      }

      final GoogleSignIn googleSignIn = GoogleSignIn(
        clientId: clientId,
        scopes: ['email', 'profile'],
      );
      
      final GoogleSignInAccount? account = await googleSignIn.signIn();
      if (account != null) {
        final GoogleSignInAuthentication auth = await account.authentication;
        final String? idToken = auth.idToken;
        if (idToken != null) {
          if (mounted) {
            context.read<AuthBloc>().add(GoogleLoginRequestedEvent(credential: idToken));
          }
        } else {
          throw Exception('Không lấy được ID Token từ Google!');
        }
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF07080E),
      body: Stack(
        children: [
          // Background Color
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    Color(0xFF131522),
                    Color(0xFF07080E),
                  ],
                  center: Alignment.center,
                  radius: 1.2,
                ),
              ),
            ),
          ),
          
          // Neon Glow Orb - Top Right
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withOpacity(0.12),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
                child: Container(color: Colors.transparent),
              ),
            ),
          ),

          // Neon Glow Orb - Bottom Left
          Positioned(
            bottom: -120,
            left: -120,
            child: Container(
              width: 380,
              height: 380,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF8B5CF6).withOpacity(0.08),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 90, sigmaY: 90),
                child: Container(color: Colors.transparent),
              ),
            ),
          ),

          // Main Interactive Layout
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 40.0),
              child: BlocConsumer<AuthBloc, AuthState>(
                listener: (context, state) {
                  if (state is AuthFailure) {
                    setState(() {
                      _errorMessage = state.error;
                      _successMessage = '';
                    });
                  } else if (state is AuthOtpPending) {
                    setState(() {
                      _otpEmail = state.email;
                      _errorMessage = '';
                      if (state.message != null) {
                        _successMessage = state.message!;
                      }
                    });
                    if (_secondsRemaining == 0) {
                      _startCountdown();
                    }
                  }
                },
                builder: (context, state) {
                  final bool isLoading = state is AuthLoading;
                  final bool isOtpPending = state is AuthOtpPending;

                  return ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 400),
                        padding: const EdgeInsets.all(36.0),
                        decoration: BoxDecoration(
                          color: const Color(0xFF131520).withOpacity(0.65),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.08),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.4),
                              blurRadius: 30,
                              spreadRadius: 5,
                            )
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Branding Logo & soundwave icon
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.graphic_eq_rounded,
                                  color: AppColors.primary,
                                  size: 32,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'RESUB',
                                  style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 3,
                                    foreground: Paint()
                                      ..shader = const LinearGradient(
                                        colors: [AppColors.primary, Color(0xFF34D399)],
                                      ).createShader(const Rect.fromLTWH(0.0, 0.0, 200.0, 70.0)),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Lồng Tiếng Video Trung - Việt Tự Động',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textMuted,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 32),

                            // Error banner
                            if (_errorMessage.isNotEmpty) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEF4444).withOpacity(0.1),
                                  border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.2)),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFF87171), size: 18),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        _errorMessage,
                                        style: const TextStyle(color: Color(0xFFFCD34D), fontSize: 12, fontWeight: FontWeight.w500),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Success banner
                            if (_successMessage.isNotEmpty) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withOpacity(0.1),
                                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.25)),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.check_circle_outline, color: Color(0xFF34D399), size: 18),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        _successMessage,
                                        style: const TextStyle(color: Color(0xFF34D399), fontSize: 12, fontWeight: FontWeight.w500),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            if (isOtpPending) ...[
                              const Center(
                                child: Icon(Icons.mark_email_read_outlined, color: AppColors.primary, size: 54),
                              ),
                              const SizedBox(height: 18),
                              const Text(
                                'Xác thực tài khoản',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Vui lòng nhập mã OTP gồm 6 chữ số đã được gửi tới email của bạn:',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: Colors.white70, height: 1.4),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _otpEmail,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                              const SizedBox(height: 24),
                              
                              // OTP Input Field
                              TextField(
                                controller: _otpController,
                                keyboardType: TextInputType.number,
                                maxLength: 6,
                                textAlign: TextAlign.center,
                                enabled: !isLoading,
                                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.primary, letterSpacing: 8),
                                decoration: InputDecoration(
                                  hintText: '******',
                                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.1), letterSpacing: 8),
                                  counterText: '',
                                  filled: true,
                                  fillColor: Colors.black.withOpacity(0.3),
                                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 24),
                              
                              // Submit OTP Button
                              ElevatedButton(
                                onPressed: isLoading ? null : _submitOtp,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.black,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  elevation: 5,
                                  shadowColor: AppColors.primary.withOpacity(0.2),
                                ),
                                child: isLoading
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                                      )
                                    : const Text(
                                        'Xác minh tài khoản',
                                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                                      ),
                              ),
                              const SizedBox(height: 20),
                              
                              // Resend OTP Section
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Text(
                                    'Không nhận được mã? ',
                                    style: TextStyle(fontSize: 12, color: Colors.white54),
                                  ),
                                  TextButton(
                                    onPressed: _secondsRemaining > 0 ? null : _resendOtp,
                                    style: TextButton.styleFrom(
                                      padding: EdgeInsets.zero,
                                      minimumSize: Size.zero,
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                    child: Text(
                                      _secondsRemaining > 0
                                          ? 'Gửi lại sau ${_secondsRemaining}s'
                                          : 'Gửi lại mã',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: _secondsRemaining > 0 ? Colors.white30 : AppColors.primary,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              
                              // Go Back Button
                              TextButton(
                                onPressed: isLoading
                                    ? null
                                    : () {
                                        context.read<AuthBloc>().add(LogoutRequestedEvent());
                                      },
                                child: const Text(
                                  'Quay lại màn hình đăng nhập',
                                  style: TextStyle(fontSize: 12, color: Colors.white38),
                                ),
                              ),
                            ] else ...[
                              // Tab Selection (Login / Register)
                              Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.3),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: InkWell(
                                        onTap: isLoading
                                            ? null
                                            : () {
                                                setState(() {
                                                  _isLogin = true;
                                                  _errorMessage = '';
                                                  _successMessage = '';
                                                });
                                              },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(vertical: 10),
                                          decoration: BoxDecoration(
                                            color: _isLogin ? AppColors.primary : Colors.transparent,
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            'Đăng nhập',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              color: _isLogin ? Colors.black : Colors.white60,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: InkWell(
                                        onTap: isLoading
                                            ? null
                                            : () {
                                                setState(() {
                                                  _isLogin = false;
                                                  _errorMessage = '';
                                                  _successMessage = '';
                                                });
                                              },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(vertical: 10),
                                          decoration: BoxDecoration(
                                            color: !_isLogin ? AppColors.primary : Colors.transparent,
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            'Đăng ký',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              color: !_isLogin ? Colors.black : Colors.white60,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 28),

                              // Username Input
                              _buildInputField(
                                label: 'Tên đăng nhập',
                                controller: _usernameController,
                                hintText: 'Tên tài khoản của bạn',
                                icon: Icons.person_outline,
                                enabled: !isLoading,
                              ),
                              const SizedBox(height: 18),

                              // Email Input (Register Only)
                              if (!_isLogin) ...[
                                _buildInputField(
                                  label: 'Địa chỉ Email',
                                  controller: _emailController,
                                  hintText: 'email@gmail.com',
                                  icon: Icons.mail_outline,
                                  enabled: !isLoading,
                                  keyboardType: TextInputType.emailAddress,
                                ),
                                const SizedBox(height: 18),
                              ],

                              // Password Input
                              _buildInputField(
                                label: 'Mật khẩu',
                                controller: _passwordController,
                                hintText: '••••••••',
                                icon: Icons.lock_outline,
                                enabled: !isLoading,
                                obscureText: true,
                              ),
                              const SizedBox(height: 18),

                              // Confirm Password (Register Only)
                              if (!_isLogin) ...[
                                _buildInputField(
                                  label: 'Nhập lại mật khẩu',
                                  controller: _confirmPasswordController,
                                  hintText: '••••••••',
                                  icon: Icons.lock_reset_outlined,
                                  enabled: !isLoading,
                                  obscureText: true,
                                ),
                                const SizedBox(height: 24),
                              ] else ...[
                                const SizedBox(height: 10),
                              ],

                              // Submit Button
                              ElevatedButton(
                                onPressed: isLoading ? null : _submit,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.black,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  elevation: 5,
                                  shadowColor: AppColors.primary.withOpacity(0.2),
                                ),
                                child: isLoading
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                                      )
                                    : Text(
                                        _isLogin ? 'Bắt đầu trải nghiệm' : 'Đăng ký tài khoản',
                                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                                      ),
                              ),
                              const SizedBox(height: 24),

                              // Third-party Divider
                              Row(
                                children: [
                                  Expanded(child: Divider(color: Colors.white.withOpacity(0.08))),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    child: Text(
                                      'HOẶC',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: Colors.white.withOpacity(0.3),
                                        letterSpacing: 1.5,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  Expanded(child: Divider(color: Colors.white.withOpacity(0.08))),
                                ],
                              ),
                              const SizedBox(height: 20),

                              // Google Sign-In Button
                              OutlinedButton.icon(
                                onPressed: isLoading ? null : _loginWithGoogle,
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white,
                                  side: BorderSide(color: Colors.white.withOpacity(0.08)),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  backgroundColor: Colors.white.withOpacity(0.02),
                                ),
                                icon: Image.network(
                                  'g-logo.png',
                                  height: 18,
                                  width: 18,
                                ),
                                label: const Text(
                                  'Đăng nhập bằng Google',
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.2),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Premium Input Field Builder Helper
  Widget _buildInputField({
    required String label,
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    required bool enabled,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white.withOpacity(0.7),
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscureText,
          enabled: enabled,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 14, color: Colors.white),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.25)),
            prefixIcon: Icon(icon, color: Colors.white.withOpacity(0.35), size: 18),
            filled: true,
            fillColor: Colors.black.withOpacity(0.25),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.white.withOpacity(0.03)),
            ),
          ),
        ),
      ],
    );
  }
}
