import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/entities/blur_mask.dart';
import '../../../domain/entities/subtitle.dart';
import 'workspace_event.dart';
import 'workspace_state.dart';

class WorkspaceBloc extends Bloc<WorkspaceEvent, WorkspaceState> {
  WorkspaceBloc() : super(const WorkspaceState()) {
    on<InitializeWorkspaceEvent>(_onInitialize);
    on<UpdatePlaybackProgressEvent>(_onUpdatePlayback);
    on<SelectSubtitleEvent>(_onSelectSubtitle);
    on<UpdateSubtitleTextEvent>(_onUpdateSubtitleText);
    on<UpdateSubtitleStyleEvent>(_onUpdateSubtitleStyle);
    on<AddBlurMaskEvent>(_onAddBlurMask);
    on<UpdateBlurMaskEvent>(_onUpdateBlurMask);
    on<DeleteBlurMaskEvent>(_onDeleteBlurMask);
    on<SelectBlurMaskEvent>(_onSelectBlurMask);
    on<UpdateSettingsEvent>(_onUpdateSettings);
    on<RequestSeekEvent>(_onRequestSeek);
    on<ClearSeekRequestEvent>(_onClearSeekRequest);
  }

  void _onInitialize(InitializeWorkspaceEvent event, Emitter<WorkspaceState> emit) {
    // Generate an initial default blur mask covering the whole video at the detected Y coordinate
    final List<BlurMask> defaultMasks = [];
    if (event.detectedHeight > 0) {
      defaultMasks.add(BlurMask(
        startTime: '00m00s000ms',
        endTime: event.subtitles.isNotEmpty ? event.subtitles.last.endTime : '99m59s999ms',
        yPercentage: event.detectedY.toDouble(),
        heightPercentage: event.detectedHeight.toDouble(),
        xPercentage: 50.0,
        widthPercentage: 80.0,
        blurRadius: 15.0,
        color: '#000000',
        opacity: 0.15,
      ));
    }

    emit(WorkspaceState(
      subtitles: event.subtitles,
      blurMasks: defaultMasks,
      videoData: event.videoData,
      subtitleYPercent: event.detectedY.toDouble(),
      subtitleFontSize: 10.0,
    ));
  }

  void _onUpdatePlayback(UpdatePlaybackProgressEvent event, Emitter<WorkspaceState> emit) {
    emit(state.copyWith(
      currentTimeMs: event.currentTimeMs,
      isPlaying: event.isPlaying,
      videoDurationMs: event.durationMs ?? state.videoDurationMs,
    ));
  }

  void _onSelectSubtitle(SelectSubtitleEvent event, Emitter<WorkspaceState> emit) {
    emit(state.copyWith(
      selectedSubtitleIndex: event.index,
      selectedMaskIndex: -1, // Clear active mask selection
    ));
  }

  void _onUpdateSubtitleText(UpdateSubtitleTextEvent event, Emitter<WorkspaceState> emit) {
    if (event.index < 0 || event.index >= state.subtitles.length) return;

    final updated = List<Subtitle>.from(state.subtitles);
    final oldVal = updated[event.index];
    updated[event.index] = oldVal.copyWith(
      text: event.text,
      chineseText: event.chineseText,
      voice: event.voice,
    );

    emit(state.copyWith(subtitles: updated));
  }

  void _onUpdateSubtitleStyle(UpdateSubtitleStyleEvent event, Emitter<WorkspaceState> emit) {
    emit(state.copyWith(
      subtitleFontSize: event.fontSize ?? state.subtitleFontSize,
      subtitleYPercent: event.yPercent ?? state.subtitleYPercent,
      subtitleColor: event.color ?? state.subtitleColor,
      subtitleOutlineColor: event.outlineColor ?? state.subtitleOutlineColor,
    ));
  }

  void _onAddBlurMask(AddBlurMaskEvent event, Emitter<WorkspaceState> emit) {
    final updated = List<BlurMask>.from(state.blurMasks)..add(event.mask);
    emit(state.copyWith(
      blurMasks: updated,
      selectedMaskIndex: updated.length - 1,
      selectedSubtitleIndex: -1, // Clear subtitle selection
    ));
  }

  void _onUpdateBlurMask(UpdateBlurMaskEvent event, Emitter<WorkspaceState> emit) {
    if (event.index < 0 || event.index >= state.blurMasks.length) return;

    final updated = List<BlurMask>.from(state.blurMasks);
    updated[event.index] = event.mask;

    emit(state.copyWith(blurMasks: updated));
  }

  void _onDeleteBlurMask(DeleteBlurMaskEvent event, Emitter<WorkspaceState> emit) {
    if (event.index < 0 || event.index >= state.blurMasks.length) return;

    final updated = List<BlurMask>.from(state.blurMasks)..removeAt(event.index);
    emit(state.copyWith(
      blurMasks: updated,
      selectedMaskIndex: -1,
    ));
  }

  void _onSelectBlurMask(SelectBlurMaskEvent event, Emitter<WorkspaceState> emit) {
    emit(state.copyWith(
      selectedMaskIndex: event.index,
      selectedSubtitleIndex: -1, // Clear subtitle selection
    ));
  }

  void _onUpdateSettings(UpdateSettingsEvent event, Emitter<WorkspaceState> emit) {
    emit(state.copyWith(
      bgVolume: event.bgVolume ?? state.bgVolume,
      ttsVolume: event.ttsVolume ?? state.ttsVolume,
      defaultVoice: event.defaultVoice ?? state.defaultVoice,
      capcutCookie: event.capcutCookie ?? state.capcutCookie,
    ));
  }

  void _onRequestSeek(RequestSeekEvent event, Emitter<WorkspaceState> emit) {
    emit(state.copyWith(seekRequestMs: event.seekMs));
  }

  void _onClearSeekRequest(ClearSeekRequestEvent event, Emitter<WorkspaceState> emit) {
    emit(state.copyWith(seekRequestMs: null));
  }
}
