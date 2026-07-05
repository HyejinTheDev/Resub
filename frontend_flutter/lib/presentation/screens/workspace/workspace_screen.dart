import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/constants/colors.dart';
import '../../../data/models/project_model.dart';
import '../../bloc/project/project_bloc.dart';
import '../../bloc/project/project_event.dart';
import '../../bloc/workspace/workspace_bloc.dart';
import '../../bloc/workspace/workspace_state.dart';

// Import workspace subcomponents
import 'player/workspace_video_player.dart';
import 'timeline/workspace_timeline.dart';
import 'inspector/inspector_panel.dart';
import 'subtitles/subtitle_list_panel.dart';

class WorkspaceScreen extends StatelessWidget {
  const WorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocListener<WorkspaceBloc, WorkspaceState>(
      listenWhen: (previous, current) {
        return current.videoData.isNotEmpty && (
          previous.subtitles != current.subtitles ||
          previous.blurMasks != current.blurMasks ||
          previous.subtitleFontSize != current.subtitleFontSize ||
          previous.subtitleYPercent != current.subtitleYPercent ||
          previous.subtitleColor != current.subtitleColor ||
          previous.subtitleOutlineColor != current.subtitleOutlineColor
        );
      },
      listener: (context, state) {
        final String projId = state.videoData['projectId'] ?? state.videoData['videoId'] ?? 'proj-default';
        final String projName = state.videoData['projectName'] ?? state.videoData['videoName'] ?? 'Dự án biên tập';

        final project = ProjectModel(
          id: projId,
          name: projName,
          createdAt: DateTime.now().millisecondsSinceEpoch,
          updatedAt: DateTime.now().millisecondsSinceEpoch,
          subtitles: state.subtitles.map((s) => s.toJson()).toList(),
          blurMasks: state.blurMasks.map((m) => m.toJson()).toList(),
          subtitleStyle: {
            'fontSize': state.subtitleFontSize,
            'yPercent': state.subtitleYPercent,
            'color': state.subtitleColor,
            'outlineColor': state.subtitleOutlineColor,
          },
          cropStyle: const {},
          videoTransform: const {},
          videoData: state.videoData,
        );

        context.read<ProjectBloc>().add(SaveCurrentProjectEvent(project));
      },
      child: BlocBuilder<WorkspaceBloc, WorkspaceState>(
        builder: (context, state) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('Phòng Làm Việc — Biên Tập Video'),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  // Go back to dashboard screen
                  Navigator.of(context).pushReplacementNamed('/');
                },
              ),
            ),
            body: LayoutBuilder(
              builder: (context, constraints) {
                final isDesktop = constraints.maxWidth >= 900;

                if (isDesktop) {
                  // Desktop Layout: 3 Columns (SubtitleList, Player, Inspector) + Full-Width Timeline at bottom (CapCut style)
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Top Half: 3 Columns
                      Expanded(
                        flex: 5,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: const [
                            Expanded(
                              flex: 25,
                              child: SubtitleListPanel(),
                            ),
                            VerticalDivider(width: 1, color: AppColors.border),
                            Expanded(
                              flex: 45,
                              child: WorkspaceVideoPlayer(),
                            ),
                            VerticalDivider(width: 1, color: AppColors.border),
                            Expanded(
                              flex: 30,
                              child: InspectorPanel(),
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1, color: AppColors.border),
                      // Bottom Half: Full-Width Timeline
                      const Expanded(
                        flex: 3,
                        child: WorkspaceTimeline(),
                      ),
                    ],
                  );
                } else {
                  // Mobile Layout: Column stack with tab views for sub lists & inspector tabs
                  return DefaultTabController(
                    length: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: const [
                        SizedBox(
                          height: 240,
                          child: WorkspaceVideoPlayer(),
                        ),
                        TabBar(
                          indicatorColor: AppColors.primary,
                          labelColor: AppColors.primary,
                          tabs: [
                            Tab(text: 'Phụ đề'),
                            Tab(text: 'Cấu hình & Xuất'),
                          ],
                        ),
                        Expanded(
                          child: TabBarView(
                            children: [
                              SubtitleListPanel(),
                              InspectorPanel(),
                            ],
                          ),
                        ),
                        SizedBox(
                          height: 120,
                          child: WorkspaceTimeline(),
                        ),
                      ],
                    ),
                  );
                }
              },
            ),
          );
        },
      ),
    );
  }
}
