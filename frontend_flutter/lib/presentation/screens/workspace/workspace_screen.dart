import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/constants/colors.dart';
import '../../bloc/workspace/workspace_bloc.dart';
import '../../bloc/workspace/workspace_state.dart';

// Placeholder widgets that we will build in the next steps
import 'player/workspace_video_player.dart';
import 'timeline/workspace_timeline.dart';
import 'inspector/inspector_panel.dart';

class WorkspaceScreen extends StatelessWidget {
  const WorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('Phòng Làm Việc — Biên Tập Video'),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () {
                // Go back to import screen (confirm first)
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Rời khỏi phòng làm việc?'),
                    content: const Text('Tất cả thay đổi chưa lưu sẽ bị mất.'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: const Text('Hủy'),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          Navigator.of(context).pushReplacementNamed('/');
                        },
                        child: const Text('Xác nhận', style: TextStyle(color: AppColors.error)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          body: LayoutBuilder(
            builder: (context, constraints) {
              final isDesktop = constraints.maxWidth >= 800;

              if (isDesktop) {
                // Desktop Layout: Player + Timeline on the left, Inspector on the right
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: const [
                          Expanded(
                            flex: 5,
                            child: WorkspaceVideoPlayer(),
                          ),
                          Expanded(
                            flex: 3,
                            child: WorkspaceTimeline(),
                          ),
                        ],
                      ),
                    ),
                    const VerticalDivider(width: 1, color: AppColors.border),
                    const SizedBox(
                      width: 320,
                      child: InspectorPanel(),
                    ),
                  ],
                );
              } else {
                // Mobile Layout: Column stack
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: const [
                    SizedBox(
                      height: 240,
                      child: WorkspaceVideoPlayer(),
                    ),
                    Expanded(
                      child: InspectorPanel(),
                    ),
                    SizedBox(
                      height: 120,
                      child: WorkspaceTimeline(),
                    ),
                  ],
                );
              }
            },
          ),
        );
      },
    );
  }
}
