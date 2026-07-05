import 'web_storage_stub.dart'
    if (dart.library.html) 'web_storage_web.dart';

class WebStorage {
  static void saveUserData(String data) {
    saveUserDataImpl(data);
  }

  static String? getUserData() {
    return getUserDataImpl();
  }

  static void clearUserData() {
    clearUserDataImpl();
  }
}
