import 'package:cross_file/cross_file.dart';
import 'package:equatable/equatable.dart';
import '../../../domain/entities/subtitle.dart';

abstract class ImportState extends Equatable {
  const ImportState();

  @override
  List<Object?> get props => [];
}

class ImportInitial extends ImportState {}

class ImportFileSelected extends ImportState {
  final XFile file;
  const ImportFileSelected(this.file);

  @override
  List<Object?> get props => [file];
}

class ImportUploading extends ImportState {
  final XFile? file;
  final double progress; // 0.0 to 1.0

  const ImportUploading({required this.file, required this.progress});

  @override
  List<Object?> get props => [file, progress];
}

class ImportTranscribing extends ImportState {
  final XFile? file;
  final int percent;
  final String message;

  const ImportTranscribing({
    required this.file,
    required this.percent,
    required this.message,
  });

  @override
  List<Object?> get props => [file, percent, message];
}

class ImportSuccess extends ImportState {
  final List<Subtitle> subtitles;
  final int detectedY;
  final int detectedHeight;
  final Map<String, dynamic> videoData;

  const ImportSuccess({
    required this.subtitles,
    required this.detectedY,
    required this.detectedHeight,
    required this.videoData,
  });

  @override
  List<Object?> get props => [subtitles, detectedY, detectedHeight, videoData];
}

class ImportFailure extends ImportState {
  final String error;
  const ImportFailure(this.error);

  @override
  List<Object?> get props => [error];
}
