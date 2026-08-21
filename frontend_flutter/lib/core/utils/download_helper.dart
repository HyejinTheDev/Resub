import 'download_helper_stub.dart'
    if (dart.library.html) 'download_helper_web.dart';

class DownloadHelper {
  static void downloadFile(String content, String filename) {
    downloadFileImpl(content, filename);
  }
}
