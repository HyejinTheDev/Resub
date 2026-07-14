import 'package:cross_file/cross_file.dart';
import '../../core/network/api_client.dart';
import '../../domain/repositories/video_repository.dart';

class VideoRepositoryImpl implements VideoRepository {
  final ApiClient apiClient;

  VideoRepositoryImpl({required this.apiClient});

  @override
  Future<Map<String, dynamic>> uploadVideo(XFile file, {void Function(int sent, int total)? onSendProgress}) async {
    return await apiClient.uploadVideo(file, onSendProgress: onSendProgress);
  }

  @override
  Future<String> startTranscription({
    required String videoPath,
    required String audioPath,
    String? geminiKey,
    bool useSystemPool = true,
  }) async {
    final result = await apiClient.transcribeVideo(
      videoPath: videoPath,
      audioPath: audioPath,
      geminiKey: geminiKey,
      useSystemPool: useSystemPool,
    );
    
    if (result['success'] == true && result['taskId'] != null) {
      return result['taskId'].toString();
    }
    throw Exception(result['error'] ?? 'Không thể khởi động dịch video');
  }

  @override
  Future<Map<String, dynamic>> getTranscriptionProgress(String taskId) async {
    return await apiClient.getTranscribeStatus(taskId);
  }

  @override
  Future<String> startDubbing(Map<String, dynamic> payload) async {
    final result = await apiClient.startDubbing(payload);
    if (result['success'] == true && result['exportId'] != null) {
      return result['exportId'].toString();
    }
    throw Exception(result['error'] ?? 'Không thể khởi động xuất video');
  }

  @override
  Future<Map<String, dynamic>> getDubbingProgress(String exportId) async {
    return await apiClient.getDubStatus(exportId);
  }

  @override
  Future<void> cancelDubbing(String exportId) async {
    await apiClient.cancelDubbing(exportId);
  }

  @override
  Future<Map<String, dynamic>> splitVideo(XFile file, double segmentMinutes, {void Function(int sent, int total)? onSendProgress}) async {
    return await apiClient.splitVideo(file, segmentMinutes, onSendProgress: onSendProgress);
  }

  @override
  Future<Map<String, dynamic>> loadSplitSegment(String filePath) async {
    return await apiClient.loadSplitSegment(filePath);
  }

  @override
  Future<String> ttsPreview({required String text, required String voice, required String capcutCookie}) async {
    final result = await apiClient.ttsPreview(text: text, voice: voice, capcutCookie: capcutCookie);
    if (result['audioUrl'] != null) {
      return result['audioUrl'].toString();
    }
    throw Exception(result['error'] ?? 'Không thể tạo âm thanh nghe thử');
  }

  @override
  Future<Map<String, dynamic>> suggestStoryboard({
    required List<dynamic> subtitles,
    String? geminiKey,
  }) async {
    final result = await apiClient.suggestStoryboard(
      subtitles: subtitles,
      geminiKey: geminiKey,
    );
    if (result['success'] == true && result['suggestion'] != null) {
      return result['suggestion'] as Map<String, dynamic>;
    }
    throw Exception(result['error'] ?? 'Không thể gợi ý kịch bản');
  }

  @override
  Future<Map<String, dynamic>> translateWithStoryboard({
    required List<dynamic> subtitles,
    required Map<String, dynamic> storyboard,
    String? geminiKey,
  }) async {
    final result = await apiClient.translateWithStoryboard(
      subtitles: subtitles,
      storyboard: storyboard,
      geminiKey: geminiKey,
    );
    if (result['success'] == true && result['subtitles'] != null) {
      return result;
    }
    throw Exception(result['error'] ?? 'Không thể dịch lại kịch bản');
  }

  @override
  Future<Map<String, dynamic>> downloadVideo(String url) async {
    return await apiClient.downloadVideo(url);
  }
}
