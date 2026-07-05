// ignore_for_file: deprecated_member_use, avoid_web_libraries_in_flutter
import 'dart:html' as html;

void saveUserDataImpl(String data) {
  try {
    html.window.name = data;
  } catch (_) {}
}

String? getUserDataImpl() {
  try {
    final val = html.window.name;
    if (val != null && val.isNotEmpty && val.startsWith('{')) {
      return val;
    }
  } catch (_) {}
  return null;
}

void clearUserDataImpl() {
  try {
    html.window.name = '';
  } catch (_) {}
}
