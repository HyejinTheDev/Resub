import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../../domain/repositories/auth_repository.dart';
import '../models/user_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  final ApiClient apiClient;

  AuthRepositoryImpl({required this.apiClient});

  static const String _userKey = 'resub_user';

  @override
  Future<UserModel?> getCachedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString(_userKey);
    if (userStr == null) return null;
    try {
      final json = jsonDecode(userStr) as Map<String, dynamic>;
      return UserModel.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<UserModel> login(String username, String password) async {
    final result = await apiClient.login(username, password);
    if (result['user'] != null) {
      final user = UserModel.fromJson(result['user'] as Map<String, dynamic>);
      await _cacheUser(user);
      return user;
    }
    throw Exception(result['error'] ?? 'Đăng nhập thất bại');
  }

  @override
  Future<UserModel> register(String username, String password) async {
    final result = await apiClient.register(username, password);
    if (result['user'] != null) {
      final user = UserModel.fromJson(result['user'] as Map<String, dynamic>);
      await _cacheUser(user);
      return user;
    }
    throw Exception(result['error'] ?? 'Đăng ký thất bại');
  }

  @override
  Future<UserModel> loginWithGoogle(String credential) async {
    final result = await apiClient.loginWithGoogle(credential);
    if (result['user'] != null) {
      final user = UserModel.fromJson(result['user'] as Map<String, dynamic>);
      await _cacheUser(user);
      return user;
    }
    throw Exception(result['error'] ?? 'Đăng nhập Google thất bại');
  }

  @override
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
  }

  @override
  Future<String?> getGoogleClientId() async {
    try {
      final result = await apiClient.getGoogleConfig();
      return result['clientId']?.toString();
    } catch (_) {
      return null;
    }
  }

  Future<void> _cacheUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }
}
