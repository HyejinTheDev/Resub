// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:convert';
import 'dart:html' as html;
import 'dart:typed_data';

void downloadFileImpl(String content, String filename) {
  try {
    final bytes = Uint8List.fromList([0xEF, 0xBB, 0xBF] + utf8.encode(content));
    final blob = html.Blob([bytes], 'text/plain');
    final url = html.Url.createObjectUrlFromBlob(blob);
    final anchor = html.AnchorElement(href: url)
      ..setAttribute("download", filename)
      ..click();
    html.Url.revokeObjectUrl(url);
  } catch (e) {
    print("Failed to download file on web: $e");
  }
}
