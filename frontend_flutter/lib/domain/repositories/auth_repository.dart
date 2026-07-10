import '../../data/models/user_model.dart';

abstract class AuthRepository {
  Future<UserModel?> getCachedUser();
  Future<UserModel> login(String username, String password);
  Future<Map<String, dynamic>> register({
    required String username,
    required String email,
    required String password,
  });
  Future<UserModel> verifyOtp(String email, String otpCode);
  Future<void> resendOtp(String email);
  Future<UserModel> loginWithGoogle(String credential);
  Future<void> logout();
  Future<String?> getGoogleClientId();
  Future<UserModel> getUserProfile(String userId);
  Future<UserModel> upgradeToPro(String userId);
  Future<String> createPaymentLink(String userId);
}
