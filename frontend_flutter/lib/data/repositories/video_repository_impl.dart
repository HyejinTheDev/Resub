import 'dart:io';
import '../../core/network/api_client.dart';
import '../../domain/repositories/video_repository.dart';

class VideoRepositoryImpl implements VideoRepository {
  final ApiClient apiClient;

  VideoRepositoryImpl({required this.apiClient});

  @override
  Future<Map<String, dynamic>> uploadVideo(File file, {void Function(int sent, int total)? onSendProgress}) async {
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
}
