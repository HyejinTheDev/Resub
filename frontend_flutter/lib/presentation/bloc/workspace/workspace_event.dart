import 'package:equatable/equatable.dart';
import '../../../domain/entities/subtitle.dart';
import '../../../domain/entities/blur_mask.dart';

abstract class WorkspaceEvent extends Equatable {
  const WorkspaceEvent();

  @override
  List<Object?> get props => [];
}

class InitializeWorkspaceEvent extends WorkspaceEvent {
  final List<Subtitle> subtitles;
  final int detectedY;
  final int detectedHeight;
  final Map<String, dynamic> videoData;

  const InitializeWorkspaceEvent({
    required this.subtitles,
    required this.detectedY,
    required this.detectedHeight,
    required this.videoData,
  });

  @override
  List<Object?> get props => [subtitles, detectedY, detectedHeight, videoData];
}

class UpdatePlaybackProgressEvent extends WorkspaceEvent {
  final int currentTimeMs;
  final bool isPlaying;
  final double? durationMs;

  const UpdatePlaybackProgressEvent({
    required this.currentTimeMs,
    required this.isPlaying,
    this.durationMs,
  });

  @override
  List<Object?> get props => [currentTimeMs, isPlaying, durationMs];
}

class SelectSubtitleEvent extends WorkspaceEvent {
  final int index;
  const SelectSubtitleEvent(this.index);

  @override
  List<Object?> get props => [index];
}

class UpdateSubtitleTextEvent extends WorkspaceEvent {
  final int index;
  final String text;
  final String chineseText;
  final String? voice;

  const UpdateSubtitleTextEvent({
    required this.index,
    required this.text,
    required this.chineseText,
    this.voice,
  });

  @override
  List<Object?> get props => [index, text, chineseText, voice];
}

class UpdateSubtitleStyleEvent extends WorkspaceEvent {
  final double? fontSize;
  final double? yPercent;
  final String? color;
  final String? outlineColor;

  const UpdateSubtitleStyleEvent({
    this.fontSize,
    this.yPercent,
    this.color,
    this.outlineColor,
  });

  @override
  List<Object?> get props => [fontSize, yPercent, color, outlineColor];
}

class AddBlurMaskEvent extends WorkspaceEvent {
  final BlurMask mask;
  const AddBlurMaskEvent(this.mask);

  @override
  List<Object?> get props => [mask];
}

class UpdateBlurMaskEvent extends WorkspaceEvent {
  final int index;
  final BlurMask mask;

  const UpdateBlurMaskEvent({required this.index, required this.mask});

  @override
  List<Object?> get props => [index, mask];
}

class DeleteBlurMaskEvent extends WorkspaceEvent {
  final int index;
  const DeleteBlurMaskEvent(this.index);

  @override
  List<Object?> get props => [index];
}

class SelectBlurMaskEvent extends WorkspaceEvent {
  final int index;
  const SelectBlurMaskEvent(this.index);

  @override
  List<Object?> get props => [index];
}

class UpdateSettingsEvent extends WorkspaceEvent {
  final double? bgVolume;
  final double? ttsVolume;
  final String? defaultVoice;
  final String? capcutCookie;

  const UpdateSettingsEvent({
    this.bgVolume,
    this.ttsVolume,
    this.defaultVoice,
    this.capcutCookie,
  });

  @override
  List<Object?> get props => [bgVolume, ttsVolume, defaultVoice, capcutCookie];
}

class RequestSeekEvent extends WorkspaceEvent {
  final int seekMs;
  const RequestSeekEvent(this.seekMs);

  @override
  List<Object?> get props => [seekMs];
}

class ClearSeekRequestEvent extends WorkspaceEvent {}
