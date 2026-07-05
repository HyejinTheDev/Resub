import 'package:cross_file/cross_file.dart';
import 'package:dio/dio.dart';

class ApiClient {
  final Dio _dio;
  
  // Default URL pointing to local server.
  // Can be dynamically changed to Hugging Face space URL in settings.
  String _baseUrl = 'http://localhost:3051';

  ApiClient() : _dio = Dio() {
    _dio.options.connectTimeout = const Duration(seconds: 30);
    _dio.options.receiveTimeout = const Duration(minutes: 5);
  }

  String get baseUrl => _baseUrl;

  void updateBaseUrl(String newUrl) {
    _baseUrl = newUrl;
  }

  /// Upload video file to backend
  Future<Map<String, dynamic>> uploadVideo(XFile file, {void Function(int, int)? onSendProgress}) async {
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
  }

  /// Start transcription & translation task
  Future<Map<String, dynamic>> transcribeVideo({
    required String videoPath,
    required String audioPath,
    String? geminiKey,
    bool useSystemPool = true,
  }) async {
    final response = await _dio.post(
      '$_baseUrl/api/transcribe',
      data: {
        'videoPath': videoPath,
        'audioPath': audioPath,
        'geminiKey': geminiKey ?? '',
        'useSystemPool': useSystemPool,
      },
    );
    return response.data as Map<String, dynamic>;
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
    final response = await _dio.post(
      '$_baseUrl/api/dub',
      data: payload,
    );
    return response.data as Map<String, dynamic>;
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
  }

  /// Load a previously split video segment as a new project
  Future<Map<String, dynamic>> loadSplitSegment(String filePath) async {
    final response = await _dio.post(
      '$_baseUrl/api/load-split-segment',
      data: {'filePath': filePath},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Login user
  Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await _dio.post(
      '$_baseUrl/api/auth/login',
      data: {'username': username, 'password': password},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Register user
  Future<Map<String, dynamic>> register(String username, String password) async {
    final response = await _dio.post(
      '$_baseUrl/api/auth/register',
      data: {'username': username, 'password': password},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Login with Google credential token
  Future<Map<String, dynamic>> loginWithGoogle(String credential) async {
    final response = await _dio.post(
      '$_baseUrl/api/auth/google',
      data: {'credential': credential},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Get Google Sign In Client ID configuration
  Future<Map<String, dynamic>> getGoogleConfig() async {
    final response = await _dio.get(
      '$_baseUrl/api/auth/google-config',
    );
    return response.data as Map<String, dynamic>;
  }
}
