import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/colors.dart';
import '../../../bloc/workspace/workspace_bloc.dart';
import '../../../bloc/workspace/workspace_event.dart';
import '../../../bloc/workspace/workspace_state.dart';

class WorkspaceTimeline extends StatefulWidget {
  const WorkspaceTimeline({super.key});

  @override
  State<WorkspaceTimeline> createState() => _WorkspaceTimelineState();
}

class _WorkspaceTimelineState extends State<WorkspaceTimeline> {
  final ScrollController _scrollController = ScrollController();
  static const double _pixelsPerSecond = 30.0; // Scale: 30 pixels per second
  static const double _pixelsPerMs = _pixelsPerSecond / 1000.0;

  int _parseTimeToMs(String timeStr) {
    final match = RegExp(r'(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?').firstMatch(timeStr);
    if (match == null) return 0;
    final m = int.tryParse(match.group(1) ?? '0') ?? 0;
    final s = int.tryParse(match.group(2) ?? '0') ?? 0;
    final ms = int.tryParse(match.group(3) ?? '0') ?? 0;
    return m * 60 * 1000 + s * 1000 + ms;
  }

  String _formatMsToRuler(int ms) {
    final totalSecs = ms ~/ 1000;
    final minutes = totalSecs ~/ 60;
    final seconds = totalSecs % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        // Calculate total duration based on video duration or the end time of the last subtitle
        double durationMs = state.videoDurationMs > 0 ? state.videoDurationMs : 30000.0;
        if (state.subtitles.isNotEmpty) {
          final lastSubEnd = _parseTimeToMs(state.subtitles.last.endTime);
          if (lastSubEnd > durationMs) {
            durationMs = lastSubEnd.toDouble() + 5000.0; // padding
          }
        }

        final double timelineWidth = durationMs * _pixelsPerMs;

        // Toolbar above the timeline (CapCut PC Style)
        final Widget toolbar = Container(
          height: 36,
          color: const Color(0xFF18181C),
          padding: const EdgeInsets.symmetric(horizontal: 12.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left Tools (Split, delete, etc.)
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.content_cut, size: 16, color: Colors.white70),
                    tooltip: 'Tách phân đoạn',
                    onPressed: () {},
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 16, color: Colors.white70),
                    tooltip: 'Xóa phân đoạn',
                    onPressed: () {
                      if (state.selectedSubtitleIndex >= 0) {
                        context.read<WorkspaceBloc>().add(DeleteSubtitleEvent(state.selectedSubtitleIndex));
                      }
                    },
                  ),
                ],
              ),
              // Right tools (Mic, Snapping, Zoom)
              Row(
                children: [
                  const Icon(Icons.mic_none, size: 16, color: Colors.white60),
                  const SizedBox(width: 16),
                  const Icon(Icons.align_horizontal_left_outlined, size: 16, color: AppColors.primary),
                  const SizedBox(width: 16),
                  const Icon(Icons.zoom_in, size: 16, color: Colors.white60),
                  const SizedBox(width: 8),
                  Container(
                    width: 80,
                    height: 2,
                    color: Colors.white24,
                  ),
                ],
              ),
            ],
          ),
        );

        return Container(
          color: const Color(0xFF0F0F12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              toolbar,
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 1. Left Track Headers (CapCut Style)
                    Container(
                      width: 90,
                      color: const Color(0xFF141418),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Ruler Corner Spacer
                          const SizedBox(height: 26),
                          
                          // Track 1 Header (Video)
                          _buildTrackHeader(Icons.video_library_outlined, 'Video'),
                          
                          // Track 2 Header (Subtitles/Text)
                          _buildTrackHeader(Icons.text_fields_outlined, 'Phụ đề'),
                          
                          // Track 3 Header (Audio)
                          _buildTrackHeader(Icons.music_note_outlined, 'Thuyết minh'),
                        ],
                      ),
                    ),
                    const VerticalDivider(width: 1, color: Colors.white10),

                    // 2. Timeline Tracks Scrollable Area
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scrollController,
                        scrollDirection: Axis.horizontal,
                        child: GestureDetector(
                          onTapDown: (details) {
                            // Click to seek video playhead
                            final clickX = details.localPosition.dx;
                            final targetMs = (clickX / _pixelsPerMs).toInt();
                            context.read<WorkspaceBloc>().add(RequestSeekEvent(targetMs.clamp(0, durationMs.toInt())));
                          },
                          child: Container(
                            width: timelineWidth,
                            color: const Color(0xFF0F0F12),
                            child: Stack(
                              children: [
                                // Time Ruler (Height: 26)
                                Positioned(
                                  left: 0,
                                  top: 0,
                                  width: timelineWidth,
                                  height: 26,
                                  child: _buildTimeRuler(durationMs),
                                ),

                                // Video Track Container (Height: 38, top: 28)
                                Positioned(
                                  left: 0,
                                  top: 28,
                                  width: timelineWidth,
                                  height: 38,
                                  child: _buildVideoTrack(state, timelineWidth),
                                ),

                                // Subtitles Track Container (Height: 38, top: 68)
                                Positioned(
                                  left: 0,
                                  top: 68,
                                  width: timelineWidth,
                                  height: 38,
                                  child: _buildSubtitlesTrack(state),
                                ),

                                // Audio Track Container (Height: 38, top: 108)
                                Positioned(
                                  left: 0,
                                  top: 108,
                                  width: timelineWidth,
                                  height: 38,
                                  child: _buildAudioTrack(state, timelineWidth),
                                ),

                                // Vertical Playhead Red Line
                                Positioned(
                                  left: state.currentTimeMs * _pixelsPerMs,
                                  top: 0,
                                  bottom: 0,
                                  width: 2,
                                  child: Container(
                                    color: Colors.redAccent,
                                    child: Stack(
                                      clipBehavior: Clip.none,
                                      children: [
                                        Positioned(
                                          top: 0,
                                          left: -4,
                                          child: Icon(
                                            Icons.arrow_drop_down,
                                            size: 10,
                                            color: Colors.redAccent,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTrackHeader(IconData icon, String title) {
    return Container(
      height: 38,
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 6.0),
      decoration: const BoxDecoration(
        color: Color(0xFF18181C),
        border: Border(bottom: BorderSide(color: Colors.white10, width: 0.5)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: Colors.white60),
              const SizedBox(width: 4),
              Text(
                title,
                style: const TextStyle(fontSize: 9, color: Colors.white70),
              ),
            ],
          ),
          Row(
            children: const [
              Icon(Icons.lock_open, size: 10, color: Colors.white24),
              SizedBox(width: 4),
              Icon(Icons.remove_red_eye_outlined, size: 10, color: Colors.white54),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTimeRuler(double durationMs) {
    final List<Widget> ticks = [];
    final int stepMs = 3000; // Tick every 3 seconds

    for (int ms = 0; ms < durationMs; ms += stepMs) {
      final double x = ms * _pixelsPerMs;
      ticks.add(
        Positioned(
          left: x,
          top: 0,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tick line
              Container(width: 1, height: 6, color: Colors.white30),
              const SizedBox(height: 2),
              // Time label
              Text(
                _formatMsToRuler(ms),
                style: const TextStyle(fontSize: 8, color: Colors.white30, fontFamily: 'monospace'),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      clipBehavior: Clip.none,
      children: ticks,
    );
  }

  Widget _buildVideoTrack(WorkspaceState state, double width) {
    final bool addedToTimeline = state.videoData['addedToTimeline'] == true;

    if (!addedToTimeline) {
      return Container(
        width: width,
        decoration: BoxDecoration(
          color: const Color(0xFF0F0F12),
          border: const Border(
            top: BorderSide(color: Colors.white10),
            bottom: BorderSide(color: Colors.white10),
          ),
        ),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 16),
        child: Text(
          'Kéo tài liệu vào đây và bắt đầu tạo',
          style: TextStyle(
            fontSize: 11,
            color: Colors.white.withValues(alpha: 0.15),
            fontStyle: FontStyle.italic,
          ),
        ),
      );
    }

    return Container(
      width: width,
      decoration: BoxDecoration(
        color: const Color(0xFF1E202C).withValues(alpha: 0.4),
        border: const Border(
          top: BorderSide(color: Colors.white10),
          bottom: BorderSide(color: Colors.white10),
        ),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: (width / 50).ceil(),
        itemBuilder: (context, index) {
          // Render colorful video thumbnails simulator
          return Container(
            width: 50,
            margin: const EdgeInsets.symmetric(horizontal: 1, vertical: 2),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.deepPurple.shade900.withValues(alpha: 0.4),
                  Colors.indigo.shade900.withValues(alpha: 0.4)
                ],
              ),
              borderRadius: BorderRadius.circular(2),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSubtitlesTrack(WorkspaceState state) {
    final List<Widget> blocks = [];

    for (int i = 0; i < state.subtitles.length; i++) {
      final sub = state.subtitles[i];
      final startMs = _parseTimeToMs(sub.startTime);
      final endMs = _parseTimeToMs(sub.endTime);

      final double left = startMs * _pixelsPerMs;
      final double width = (endMs - startMs) * _pixelsPerMs;

      final bool isSelected = state.selectedSubtitleIndex == i;
      final bool isActive = state.currentTimeMs >= startMs && state.currentTimeMs <= endMs;

      blocks.add(
        Positioned(
          left: left,
          width: width.clamp(15.0, 10000.0),
          top: 2,
          bottom: 2,
          child: GestureDetector(
            onTap: () {
              context.read<WorkspaceBloc>().add(SelectSubtitleEvent(i));
              context.read<WorkspaceBloc>().add(RequestSeekEvent(startMs));
            },
            child: Container(
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFFEA580C) // Active Orange
                    : (isActive ? const Color(0xFF9A3412) : const Color(0xFF431407)), // Dark Capcut orange
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: isSelected ? Colors.white : Colors.white24,
                  width: isSelected ? 1.5 : 0.5,
                ),
              ),
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.symmetric(horizontal: 4.0),
              child: Text(
                sub.text,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : Colors.white70,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Stack(
      children: blocks,
    );
  }

  Widget _buildAudioTrack(WorkspaceState state, double timelineWidth) {
    final List<Widget> blocks = [];

    // Background simulated waveform
    blocks.add(
      Positioned.fill(
        child: CustomPaint(
          painter: WaveformPainter(),
        ),
      ),
    );

    for (int i = 0; i < state.subtitles.length; i++) {
      final sub = state.subtitles[i];
      final startMs = _parseTimeToMs(sub.startTime);
      final endMs = _parseTimeToMs(sub.endTime);

      final double left = startMs * _pixelsPerMs;
      final double width = (endMs - startMs) * _pixelsPerMs;

      final bool isSelected = state.selectedSubtitleIndex == i;
      final bool isActive = state.currentTimeMs >= startMs && state.currentTimeMs <= endMs;

      blocks.add(
        Positioned(
          left: left,
          width: width.clamp(15.0, 10000.0),
          top: 4,
          bottom: 4,
          child: GestureDetector(
            onTap: () {
              context.read<WorkspaceBloc>().add(SelectSubtitleEvent(i));
              context.read<WorkspaceBloc>().add(RequestSeekEvent(startMs));
            },
            child: Container(
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFF0D9488) // Active Teal
                    : (isActive ? const Color(0xFF0F766E) : const Color(0xFF115E59)), // Dark Teal
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: isSelected ? Colors.white : Colors.white24,
                  width: isSelected ? 1.5 : 0.5,
                ),
              ),
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.symmetric(horizontal: 4.0),
              child: Text(
                sub.text,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : Colors.white70,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      width: timelineWidth,
      decoration: BoxDecoration(
        color: const Color(0xFF0C1020).withValues(alpha: 0.3),
        border: const Border(
          top: BorderSide(color: Colors.white10),
          bottom: BorderSide(color: Colors.white10),
        ),
      ),
      child: Stack(
        children: blocks,
      ),
    );
  }
}

class WaveformPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.cyan.withValues(alpha: 0.25)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    final path = Path();
    double yCenter = size.height / 2;
    double x = 0;
    
    // Draw simple simulated waveform
    path.moveTo(0, yCenter);
    while (x < size.width) {
      double heightFactor = (x % 40 == 0) ? 12 : ((x % 20 == 0) ? 6 : 2);
      path.lineTo(x, yCenter - heightFactor);
      path.lineTo(x, yCenter + heightFactor);
      path.lineTo(x, yCenter);
      x += 4;
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
