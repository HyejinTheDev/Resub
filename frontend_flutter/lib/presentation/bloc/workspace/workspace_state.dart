import 'package:equatable/equatable.dart';
import '../../../domain/entities/subtitle.dart';
import '../../../domain/entities/blur_mask.dart';

class WorkspaceState extends Equatable {
  final List<Subtitle> subtitles;
  final List<BlurMask> blurMasks;
  final Map<String, dynamic> videoData;
  final double bgVolume;
  final double ttsVolume;
  final String defaultVoice;
  final String capcutCookie;
  
  // Subtitle Style
  final double subtitleFontSize;
  final double subtitleYPercent;
  final String subtitleColor;
  final String subtitleOutlineColor;
  
  // Selected elements
  final int selectedSubtitleIndex;
  final int selectedMaskIndex;
  
  // Playback state
  final int currentTimeMs;
  final bool isPlaying;
  final double videoDurationMs;
  final int? seekRequestMs;

  const WorkspaceState({
    this.subtitles = const [],
    this.blurMasks = const [],
    this.videoData = const {},
    this.bgVolume = 0.15,
    this.ttsVolume = 1.0,
    this.defaultVoice = 'vi-VN-HoaiMyNeural',
    this.capcutCookie = '',
    this.subtitleFontSize = 10,
    this.subtitleYPercent = 85,
    this.subtitleColor = '#EAB308', // Default gold yellow
    this.subtitleOutlineColor = '#000000',
    this.selectedSubtitleIndex = -1,
    this.selectedMaskIndex = -1,
    this.currentTimeMs = 0,
    this.isPlaying = false,
    this.videoDurationMs = 0,
    this.seekRequestMs,
  });

  WorkspaceState copyWith({
    List<Subtitle>? subtitles,
    List<BlurMask>? blurMasks,
    Map<String, dynamic>? videoData,
    double? bgVolume,
    double? ttsVolume,
    String? defaultVoice,
    String? capcutCookie,
    double? subtitleFontSize,
    double? subtitleYPercent,
    String? subtitleColor,
    String? subtitleOutlineColor,
    int? selectedSubtitleIndex,
    int? selectedMaskIndex,
    int? currentTimeMs,
    bool? isPlaying,
    double? videoDurationMs,
    int? seekRequestMs,
  }) {
    return WorkspaceState(
      subtitles: subtitles ?? this.subtitles,
      blurMasks: blurMasks ?? this.blurMasks,
      videoData: videoData ?? this.videoData,
      bgVolume: bgVolume ?? this.bgVolume,
      ttsVolume: ttsVolume ?? this.ttsVolume,
      defaultVoice: defaultVoice ?? this.defaultVoice,
      capcutCookie: capcutCookie ?? this.capcutCookie,
      subtitleFontSize: subtitleFontSize ?? this.subtitleFontSize,
      subtitleYPercent: subtitleYPercent ?? this.subtitleYPercent,
      subtitleColor: subtitleColor ?? this.subtitleColor,
      subtitleOutlineColor: subtitleOutlineColor ?? this.subtitleOutlineColor,
      selectedSubtitleIndex: selectedSubtitleIndex ?? this.selectedSubtitleIndex,
      selectedMaskIndex: selectedMaskIndex ?? this.selectedMaskIndex,
      currentTimeMs: currentTimeMs ?? this.currentTimeMs,
      isPlaying: isPlaying ?? this.isPlaying,
      videoDurationMs: videoDurationMs ?? this.videoDurationMs,
      seekRequestMs: seekRequestMs, // Overwritten directly on request
    );
  }

  @override
  List<Object?> get props => [
        subtitles,
        blurMasks,
        videoData,
        bgVolume,
        ttsVolume,
        defaultVoice,
        capcutCookie,
        subtitleFontSize,
        subtitleYPercent,
        subtitleColor,
        subtitleOutlineColor,
        selectedSubtitleIndex,
        selectedMaskIndex,
        currentTimeMs,
        isPlaying,
        videoDurationMs,
        seekRequestMs,
      ];
}
