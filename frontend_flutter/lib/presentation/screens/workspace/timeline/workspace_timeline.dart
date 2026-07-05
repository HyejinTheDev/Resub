import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/colors.dart';
import '../../../bloc/workspace/workspace_bloc.dart';
import '../../../bloc/workspace/workspace_event.dart';
import '../../../bloc/workspace/workspace_state.dart';

class WorkspaceTimeline extends StatelessWidget {
  const WorkspaceTimeline({super.key});

  int _parseTimeToMs(String timeStr) {
    final match = RegExp(r'(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?').firstMatch(timeStr);
    if (match == null) return 0;
    final m = int.tryParse(match.group(1) ?? '0') ?? 0;
    final s = int.tryParse(match.group(2) ?? '0') ?? 0;
    final ms = int.tryParse(match.group(3) ?? '0') ?? 0;
    return m * 60 * 1000 + s * 1000 + ms;
  }

  double _calculateWidthFactor(String start, String end) {
    final startMs = _parseTimeToMs(start);
    final endMs = _parseTimeToMs(end);
    final durationSec = (endMs - startMs) / 1000.0;
    
    // Scale width: 40 pixels per second, min 60px, max 300px
    double w = durationSec * 40.0;
    return w.clamp(70.0, 300.0);
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        if (state.subtitles.isEmpty) {
          return const Center(
            child: Text(
              'Không có phụ đề hiển thị.',
              style: TextStyle(color: AppColors.textMuted),
            ),
          );
        }

        return Container(
          color: AppColors.background,
          padding: const EdgeInsets.symmetric(vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Timeline Header Info
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'DÒNG THỜI GIAN (TIMELINE)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textMuted,
                        letterSpacing: 1,
                      ),
                    ),
                    Text(
                      'Tổng số: ${state.subtitles.length} phân đoạn',
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // Horizontal Scrollable Tracks
              Expanded(
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  itemCount: state.subtitles.length,
                  itemBuilder: (context, index) {
                    final sub = state.subtitles[index];
                    final startMs = _parseTimeToMs(sub.startTime);
                    final endMs = _parseTimeToMs(sub.endTime);
                    
                    final bool isActive = state.currentTimeMs >= startMs && state.currentTimeMs <= endMs;
                    final bool isSelected = state.selectedSubtitleIndex == index;
                    final width = _calculateWidthFactor(sub.startTime, sub.endTime);

                    return GestureDetector(
                      onTap: () {
                        context.read<WorkspaceBloc>().add(SelectSubtitleEvent(index));
                        context.read<WorkspaceBloc>().add(RequestSeekEvent(startMs));
                      },
                      child: Container(
                        width: width,
                        margin: const EdgeInsets.only(right: 8.0),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primary.withValues(alpha: 0.2)
                              : (isActive ? AppColors.surfaceLight : AppColors.surface),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : (isActive ? AppColors.secondary : AppColors.border),
                            width: isSelected ? 2.0 : 1.0,
                          ),
                          boxShadow: isActive && !isSelected
                              ? [
                                  BoxShadow(
                                    color: AppColors.secondary.withValues(alpha: 0.2),
                                    blurRadius: 4,
                                    spreadRadius: 1,
                                  )
                                ]
                              : null,
                        ),
                        padding: const EdgeInsets.all(8.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isSelected ? AppColors.primary : AppColors.border,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    '#${index + 1}',
                                    style: const TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                Text(
                                  sub.startTime.split('m').last.replaceAll('ms', ''),
                                  style: const TextStyle(
                                    fontSize: 9,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Expanded(
                              child: Text(
                                sub.text,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: isSelected || isActive ? FontWeight.bold : FontWeight.normal,
                                  color: isSelected || isActive ? Colors.white : AppColors.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
