import '../../data/models/user_model.dart';

abstract class AuthRepository {
  Future<UserModel?> getCachedUser();
  Future<UserModel> login(String username, String password);
  Future<UserModel> register(String username, String password);
  Future<UserModel> loginWithGoogle(String credential);
  Future<void> logout();
  Future<String?> getGoogleClientId();
}
