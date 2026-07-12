import 'package:cross_file/cross_file.dart';
import 'package:equatable/equatable.dart';

abstract class ImportEvent extends Equatable {
  const ImportEvent();

  @override
  List<Object?> get props => [];
}

class SelectVideoEvent extends ImportEvent {
  final XFile file;
  const SelectVideoEvent(this.file);

  @override
  List<Object?> get props => [file];
}

class StartUploadAndTranscribeEvent extends ImportEvent {
  final String? geminiKey;
  final bool useSystemPool;

  const StartUploadAndTranscribeEvent({
    this.geminiKey,
    this.useSystemPool = true,
  });

  @override
  List<Object?> get props => [geminiKey, useSystemPool];
}

class PollProgressEvent extends ImportEvent {
  final String taskId;
  const PollProgressEvent(this.taskId);

  @override
  List<Object?> get props => [taskId];
}

class ResetImportEvent extends ImportEvent {}

class LoadSegmentAndTranscribeEvent extends ImportEvent {
  final String filePath;
  final String? geminiKey;
  final bool useSystemPool;

  const LoadSegmentAndTranscribeEvent({
    required this.filePath,
    this.geminiKey,
    this.useSystemPool = true,
  });

  @override
  List<Object?> get props => [filePath, geminiKey, useSystemPool];
}

class UploadVideoOnlyEvent extends ImportEvent {
  const UploadVideoOnlyEvent();
}

class StartTranscriptionOnlyEvent extends ImportEvent {
  final String videoPath;
  final String audioPath;
  final String? geminiKey;
  final bool useSystemPool;

  const StartTranscriptionOnlyEvent({
    required this.videoPath,
    required this.audioPath,
    this.geminiKey,
    this.useSystemPool = true,
  });

  @override
  List<Object?> get props => [videoPath, audioPath, geminiKey, useSystemPool];
}
