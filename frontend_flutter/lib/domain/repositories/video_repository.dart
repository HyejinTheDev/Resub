import 'dart:io';

abstract class VideoRepository {
  /// Upload a video file to the server.
  /// Returns the server paths/metadata for videoPath, audioPath, videoUrl.
  Future<Map<String, dynamic>> uploadVideo(File file, {void Function(int sent, int total)? onSendProgress});

  /// Trigger the transcription AI request.
  /// Returns the taskId for polling.
  Future<String> startTranscription({
    required String videoPath,
    required String audioPath,
    String? geminiKey,
    bool useSystemPool,
  });

  /// Poll the active transcription task progress.
  /// Returns a map with state information: status, percent, message, subtitles, detectedPosition.
  Future<Map<String, dynamic>> getTranscriptionProgress(String taskId);

  /// Trigger the background export and dubbing pass.
  /// Returns the exportId for polling.
  Future<String> startDubbing(Map<String, dynamic> payload);

  /// Poll the active dubbing export task progress.
  /// Returns status, percent, message, and videoUrl when done.
  Future<Map<String, dynamic>> getDubbingProgress(String exportId);

  /// Cancel a running export task on the server.
  Future<void> cancelDubbing(String exportId);
}
