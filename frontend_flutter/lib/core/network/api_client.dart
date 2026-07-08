import 'package:cross_file/cross_file.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

class ApiClient {
  final Dio _dio;
  
  // Default URL pointing to local server.
  // Can be dynamically changed to Hugging Face space URL in settings.
  String _baseUrl = 'http://localhost:3051';

  ApiClient() : _dio = Dio() {
    _dio.options.connectTimeout = const Duration(minutes: 5);
    _dio.options.sendTimeout = const Duration(minutes: 15);
    _dio.options.receiveTimeout = const Duration(minutes: 15);

    if (kIsWeb) {
      final String origin = Uri.base.origin;
      if (origin.contains('localhost') || origin.contains('127.0.0.1')) {
        _baseUrl = 'http://localhost:3051';
      } else {
        _baseUrl = origin;
      }
    }
  }

  String get baseUrl => _baseUrl;

  void updateBaseUrl(String newUrl) {
    _baseUrl = newUrl;
  }

  /// Upload video file to backend
  Future<Map<String, dynamic>> uploadVideo(XFile file, {void Function(int, int)? onSendProgress}) async {
    try {
      final bytes = await file.readAsBytes();
      final FormData formData = FormData.fromMap({
        "video": MultipartFile.fromBytes(
          bytes,
          filename: file.name,
        ),
      });

      final response = await _dio.post(
        '$_baseUrl/api/upload',
        data: formData,
        onSendProgress: onSendProgress,
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Lỗi tải video lên máy chủ: ${e.message}');
    }
  }

  /// Start transcription & translation task
  Future<Map<String, dynamic>> transcribeVideo({
    required String videoPath,
    required String audioPath,
    String? geminiKey,
    bool useSystemPool = true,
  }) async {
    final String resolvedTaskId = const Uuid().v4();
    try {
      final response = await _dio.post(
        '$_baseUrl/api/transcribe',
        data: {
          'videoPath': videoPath,
          'audioPath': audioPath,
          'geminiKey': geminiKey ?? '',
          'useSystemPool': useSystemPool,
          'taskId': resolvedTaskId,
        },
      );
      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true || data['taskId'] == null) {
        data['taskId'] = resolvedTaskId;
      }
      return data;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Lỗi nhận dạng video: ${e.message}');
    }
  }

  /// Get active transcription task progress
  Future<Map<String, dynamic>> getTranscribeStatus(String taskId) async {
    final response = await _dio.get(
      '$_baseUrl/api/transcribe-status',
      queryParameters: {'taskId': taskId},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Trigger video export & dubbing complex pass
  Future<Map<String, dynamic>> startDubbing(Map<String, dynamic> payload) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/api/dub',
        data: payload,
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Lỗi xuất video: ${e.message}');
    }
  }

  /// Poll video export status
  Future<Map<String, dynamic>> getDubStatus(String exportId) async {
    final response = await _dio.get(
      '$_baseUrl/api/dub-status',
      queryParameters: {'exportId': exportId},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Cancel background video export task
  Future<Map<String, dynamic>> cancelDubbing(String exportId) async {
    final response = await _dio.post(
      '$_baseUrl/api/dub-cancel',
      data: {'exportId': exportId},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Split a long video file into segments
  Future<Map<String, dynamic>> splitVideo(XFile file, double segmentMinutes, {void Function(int, int)? onSendProgress}) async {
    try {
      final bytes = await file.readAsBytes();
      final FormData formData = FormData.fromMap({
        "video": MultipartFile.fromBytes(
          bytes,
          filename: file.name,
        ),
        "segmentMinutes": segmentMinutes,
      });

      final response = await _dio.post(
        '$_baseUrl/api/split-video',
        data: formData,
        onSendProgress: onSendProgress,
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Lỗi cắt nhỏ video: ${e.message}');
    }
  }

  /// Load a previously split video segment as a new project
  Future<Map<String, dynamic>> loadSplitSegment(String filePath) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/api/load-split-segment',
        data: {'filePath': filePath},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Lỗi nạp phân đoạn: ${e.message}');
    }
  }

  /// Login user
  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/api/auth/login',
        data: {'username': username, 'password': password},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Sai tên đăng nhập hoặc mật khẩu!');
    }
  }

  /// Register user
  Future<Map<String, dynamic>> register(String username, String password) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/api/auth/register',
        data: {'username': username, 'password': password},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Tài khoản đã tồn tại!');
    }
  }

  /// Login with Google credential token
  Future<Map<String, dynamic>> loginWithGoogle(String credential) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/api/auth/google',
        data: {'credential': credential},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Lỗi đăng nhập Google: ${e.message}');
    }
  }

  /// Get Google Sign In Client ID configuration
  Future<Map<String, dynamic>> getGoogleConfig() async {
    final response = await _dio.get(
      '$_baseUrl/api/auth/google-config',
    );
    return response.data as Map<String, dynamic>;
  }

  /// Generate TTS preview audio URL
  Future<Map<String, dynamic>> ttsPreview({
    required String text,
    required String voice,
    required String capcutCookie,
  }) async {
    try {
      final response = await _dio.post(
        '$_baseUrl/api/tts-preview',
        data: {
          'text': text,
          'voice': voice,
          'capcutCookie': capcutCookie,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
        final data = e.response?.data;
        if (data is Map && data.containsKey('error')) {
          throw Exception(data['error']);
        }
      }
      throw Exception('Lỗi nghe thử: ${e.message}');
    }
  }
}
