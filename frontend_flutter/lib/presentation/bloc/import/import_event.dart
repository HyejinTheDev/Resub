import 'dart:io';
import 'package:equatable/equatable.dart';

abstract class ImportEvent extends Equatable {
  const ImportEvent();

  @override
  List<Object?> get props => [];
}

class SelectVideoEvent extends ImportEvent {
  final File file;
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
