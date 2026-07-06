import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:video_player/video_player.dart';

import 'platform_view_helper.dart';

import '../../../../core/constants/colors.dart';
import '../../../bloc/workspace/workspace_bloc.dart';
import '../../../bloc/workspace/workspace_event.dart';
import '../../../bloc/workspace/workspace_state.dart';
import '../../../../domain/entities/subtitle.dart';

class WorkspaceVideoPlayer extends StatefulWidget {
  const WorkspaceVideoPlayer({super.key});

  @override
  State<WorkspaceVideoPlayer> createState() => _WorkspaceVideoPlayerState();
}

class _WorkspaceVideoPlayerState extends State<WorkspaceVideoPlayer> {
  VideoPlayerController? _controller;
  bool _isDraggingSubtitle = false;
  double _dragYPercent = 85.0;

  @override
  void initState() {
    super.initState();
    _initializeController();
  }

  void _initializeController() {
    final state = context.read<WorkspaceBloc>().state;
    final String? videoUrl = state.videoData['videoUrl'];
    
    if (videoUrl != null && videoUrl.isNotEmpty) {
      _controller = VideoPlayerController.networkUrl(Uri.parse(videoUrl));
      // Force mute on startup to satisfy browser sandbox/iframe autoplay block
      _controller!.setVolume(0.0);
      _controller!.initialize().then((_) {
        // Restore background volume once successfully initialized
        _controller!.setVolume(state.bgVolume);
        setState(() {});
        _controller!.addListener(_onPlayerUpdate);
      }).catchError((error) {
        debugPrint('VideoPlayer initialization error: $error');
        setState(() {});
      });
    }
  }

  void _onPlayerUpdate() {
    if (_controller == null) return;
    
    final currentMs = _controller!.value.position.inMilliseconds;
    final isPlaying = _controller!.value.isPlaying;
    final durationMs = _controller!.value.duration.inMilliseconds.toDouble();

    context.read<WorkspaceBloc>().add(
      UpdatePlaybackProgressEvent(
        currentTimeMs: currentMs,
        isPlaying: isPlaying,
        durationMs: durationMs,
      ),
    );
  }

  @override
  void dispose() {
    _controller?.removeListener(_onPlayerUpdate);
    _controller?.dispose();
    super.dispose();
  }

  // Parse custom ASS-like time string ("00m01s200ms") into milliseconds
  int _parseTimeToMs(String timeStr) {
    final match = RegExp(r'(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?').firstMatch(timeStr);
    if (match == null) return 0;
    final m = int.tryParse(match.group(1) ?? '0') ?? 0;
    final s = int.tryParse(match.group(2) ?? '0') ?? 0;
    final ms = int.tryParse(match.group(3) ?? '0') ?? 0;
    return m * 60 * 1000 + s * 1000 + ms;
  }

  // Helper to convert hex string ("#ffffff") to Color object
  Color _colorFromHex(String hexColor) {
    final hexCode = hexColor.replaceAll('#', '');
    return Color(int.parse('FF$hexCode', radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null || !_controller!.value.isInitialized) {
      final state = context.read<WorkspaceBloc>().state;
      final String videoUrl = state.videoData['videoUrl'] ?? '';
      final String? errorMsg = _controller?.value.errorDescription;

      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(color: AppColors.primary),
              const SizedBox(height: 16),
              Text(
                'Đang tải video...\n$videoUrl',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              if (errorMsg != null) ...[
                const SizedBox(height: 12),
                Text(
                  'Lỗi: $errorMsg',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: AppColors.error),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return BlocListener<WorkspaceBloc, WorkspaceState>(
      listenWhen: (previous, current) =>
          current.seekRequestMs != null &&
          current.seekRequestMs != previous.seekRequestMs,
      listener: (context, state) {
        if (state.seekRequestMs != null) {
          _controller!.seekTo(Duration(milliseconds: state.seekRequestMs!));
          context.read<WorkspaceBloc>().add(ClearSeekRequestEvent());
        }
      },
      child: BlocBuilder<WorkspaceBloc, WorkspaceState>(
        builder: (context, state) {
        // Find active subtitle
        final activeSub = state.subtitles.firstWhere(
          (sub) {
            final start = _parseTimeToMs(sub.startTime);
            final end = _parseTimeToMs(sub.endTime);
            return state.currentTimeMs >= start && state.currentTimeMs <= end;
          },
          orElse: () => const Subtitle(startTime: '', endTime: '', chineseText: '', text: ''),
        );

        final hasActiveSubtitle = activeSub.text.isNotEmpty;
        final currentY = _isDraggingSubtitle ? _dragYPercent : state.subtitleYPercent;
        final showSnappingGuide = _isDraggingSubtitle && (currentY - 50.0).abs() < 2.0;

        return LayoutBuilder(
          builder: (context, constraints) {
            return Container(
              color: Colors.black,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // 1. Video Player
                  AspectRatio(
                    aspectRatio: _controller!.value.aspectRatio,
                    child: VideoPlayer(_controller!),
                  ),

                  // 2. Snapping Guideline (Horizontal line at 50% Y coordinate)
                  if (showSnappingGuide)
                    Positioned(
                      top: constraints.maxHeight * 0.5,
                      left: 0,
                      right: 0,
                      child: Container(
                        height: 1,
                        color: Colors.pink,
                      ),
                    ),

                  // 3. Blur masks simulation (cheats with semi-transparent card)
                  ...state.blurMasks.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final mask = entry.value;
                    final start = _parseTimeToMs(mask.startTime);
                    final end = _parseTimeToMs(mask.endTime);
                    final isVisible = state.currentTimeMs >= start && state.currentTimeMs <= end;

                    if (!isVisible || !mask.enabled) return const SizedBox.shrink();

                    final bool isSelected = state.selectedMaskIndex == idx;

                    // Calculate positioning coordinates
                    final double left = constraints.maxWidth * (mask.xPercentage - mask.widthPercentage / 2) / 100;
                    final double top = constraints.maxHeight * (mask.yPercentage - mask.heightPercentage / 2) / 100;
                    final double width = constraints.maxWidth * mask.widthPercentage / 100;
                    final double height = constraints.maxHeight * mask.heightPercentage / 100;

                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      updateBlurMaskStyles(
                        idx,
                        mask.blurRadius,
                        mask.color,
                        mask.opacity,
                      );
                    });

                    final Widget maskWidget = Stack(
                      children: [
                        HtmlElementView(viewType: 'blur-mask-view-$idx'),
                        Container(
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: isSelected ? AppColors.primary : AppColors.primary.withValues(alpha: 0.4),
                              width: isSelected ? 2.5 : 1.5,
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ],
                    );

                    if (!isSelected) {
                      return Positioned(
                        left: left,
                        top: top,
                        width: width,
                        height: height,
                        child: GestureDetector(
                          onTap: () {
                            context.read<WorkspaceBloc>().add(SelectBlurMaskEvent(idx));
                          },
                          child: maskWidget,
                        ),
                      );
                    }

                    // Selected Mask: Allows dragging to move and resize handle
                    return Positioned(
                      left: left,
                      top: top,
                      width: width,
                      height: height,
                      child: SizedBox(
                        width: width,
                        height: height,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            // Move drag detector
                            Positioned.fill(
                              child: GestureDetector(
                                onPanUpdate: (details) {
                                  final deltaXPercent = (details.delta.dx / constraints.maxWidth) * 100;
                                  final deltaYPercent = (details.delta.dy / constraints.maxHeight) * 100;
                                  final newX = (mask.xPercentage + deltaXPercent).clamp(0.0, 100.0);
                                  final newY = (mask.yPercentage + deltaYPercent).clamp(0.0, 100.0);
                                  context.read<WorkspaceBloc>().add(
                                        UpdateBlurMaskEvent(
                                          index: idx,
                                          mask: mask.copyWith(xPercentage: newX, yPercentage: newY),
                                        ),
                                      );
                                },
                                child: maskWidget,
                              ),
                            ),
                            // Resize corner handle (bottom-right)
                            Positioned(
                              right: -8,
                              bottom: -8,
                              child: GestureDetector(
                                onPanUpdate: (details) {
                                  final deltaWidthPercent = (details.delta.dx / constraints.maxWidth) * 100 * 2;
                                  final deltaHeightPercent = (details.delta.dy / constraints.maxHeight) * 100 * 2;
                                  final newW = (mask.widthPercentage + deltaWidthPercent).clamp(5.0, 100.0);
                                  final newH = (mask.heightPercentage + deltaHeightPercent).clamp(2.0, 100.0);
                                  context.read<WorkspaceBloc>().add(
                                        UpdateBlurMaskEvent(
                                          index: idx,
                                          mask: mask.copyWith(widthPercentage: newW, heightPercentage: newH),
                                        ),
                                      );
                                },
                                child: Container(
                                  width: 18,
                                  height: 18,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.zoom_out_map, size: 10, color: Colors.black),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),

                  // 4. Subtitle Overlay (Draggable widget)
                  if (hasActiveSubtitle)
                    Positioned(
                      top: constraints.maxHeight * (currentY / 100) - 20,
                      left: 20,
                      right: 20,
                      child: GestureDetector(
                        onVerticalDragStart: (_) {
                          setState(() {
                            _isDraggingSubtitle = true;
                            _dragYPercent = state.subtitleYPercent;
                          });
                        },
                        onVerticalDragUpdate: (details) {
                          setState(() {
                            // Convert delta dy to percentage
                            final deltaYPercent = (details.primaryDelta! / constraints.maxHeight) * 100;
                            var newY = _dragYPercent + deltaYPercent;
                            newY = newY.clamp(10.0, 95.0);
                            
                            // Snapping logic: if within 2% of 50%, snap to exactly 50%
                            if ((newY - 50.0).abs() < 2.0) {
                              newY = 50.0;
                            }
                            
                            _dragYPercent = newY;
                          });
                        },
                        onVerticalDragEnd: (_) {
                          setState(() {
                            _isDraggingSubtitle = false;
                          });
                          context.read<WorkspaceBloc>().add(
                            UpdateSubtitleStyleEvent(yPercent: _dragYPercent),
                          );
                        },
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              // Thick border stroke behind the text
                              Text(
                                activeSub.text,
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                style: TextStyle(
                                  fontSize: (state.subtitleFontSize + 12) * 0.7,
                                  fontWeight: FontWeight.bold,
                                  foreground: Paint()
                                    ..style = PaintingStyle.stroke
                                    ..strokeWidth = 5.0
                                    ..color = _colorFromHex(state.subtitleOutlineColor),
                                ),
                              ),
                              // Solid foreground text
                              Text(
                                activeSub.text,
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                style: TextStyle(
                                  color: _colorFromHex(state.subtitleColor),
                                  fontSize: (state.subtitleFontSize + 12) * 0.7,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                  // 5. Playback Controller Buttons overlay (glassmorphic bottom bar)
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      color: Colors.black.withValues(alpha: 0.6),
                      child: Row(
                        children: [
                          IconButton(
                            icon: Icon(
                              _controller!.value.isPlaying ? Icons.pause : Icons.play_arrow,
                              color: Colors.white,
                            ),
                            onPressed: () {
                              setState(() {
                                if (_controller!.value.isPlaying) {
                                  _controller!.pause();
                                } else {
                                  _controller!.play();
                                }
                              });
                            },
                          ),
                          Text(
                            _formatDuration(_controller!.value.position),
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                          Expanded(
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                activeTrackColor: AppColors.primary,
                                inactiveTrackColor: AppColors.border,
                                thumbColor: AppColors.primary,
                                trackHeight: 3,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                              ),
                              child: Slider(
                                min: 0.0,
                                max: _controller!.value.duration.inMilliseconds.toDouble(),
                                value: _controller!.value.position.inMilliseconds.toDouble().clamp(
                                  0.0,
                                  _controller!.value.duration.inMilliseconds.toDouble(),
                                ),
                                onChanged: (value) {
                                  _controller!.seekTo(Duration(milliseconds: value.toInt()));
                                },
                              ),
                            ),
                          ),
                          Text(
                            _formatDuration(_controller!.value.duration),
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    ),
  );
}

  String _formatDuration(Duration duration) {
    final mins = duration.inMinutes;
    final secs = duration.inSeconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }
}
