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
  final String password;

  const RegisterRequestedEvent({required this.username, required this.password});

  @override
  List<Object?> get props => [username, password];
}

class GoogleLoginRequestedEvent extends AuthEvent {
  final String credential;

  const GoogleLoginRequestedEvent({required this.credential});

  @override
  List<Object?> get props => [credential];
}

class LogoutRequestedEvent extends AuthEvent {}
