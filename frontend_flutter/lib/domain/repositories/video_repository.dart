import 'package:cross_file/cross_file.dart';

abstract class VideoRepository {
  /// Upload a video file to the server.
  /// Returns the server paths/metadata for videoPath, audioPath, videoUrl.
  Future<Map<String, dynamic>> uploadVideo(XFile file, {void Function(int sent, int total)? onSendProgress});

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

  /// Split a long video file into segments.
  Future<Map<String, dynamic>> splitVideo(XFile file, double segmentMinutes, {void Function(int sent, int total)? onSendProgress});

  /// Load a previously split video segment as a new project.
  Future<Map<String, dynamic>> loadSplitSegment(String filePath);
}
