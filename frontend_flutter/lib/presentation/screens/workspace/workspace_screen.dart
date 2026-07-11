import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/constants/colors.dart';
import '../../../data/models/project_model.dart';
import '../../bloc/project/project_bloc.dart';
import '../../bloc/project/project_event.dart';
import '../../bloc/workspace/workspace_bloc.dart';
import '../../bloc/workspace/workspace_state.dart';
import '../../bloc/workspace/workspace_event.dart';

// Import workspace subcomponents
import 'player/workspace_video_player.dart';
import 'timeline/workspace_timeline.dart';
import 'inspector/inspector_panel.dart';
import 'subtitles/subtitle_list_panel.dart';

import '../../bloc/import/import_bloc.dart';
import '../../bloc/import/import_event.dart';
import '../../bloc/import/import_state.dart';
import 'package:file_picker/file_picker.dart';
import 'package:cross_file/cross_file.dart';
import 'package:flutter/foundation.dart';

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
      child: BlocListener<ImportBloc, ImportState>(
        listener: (context, importState) {
          if (importState is ImportUploadSuccess) {
            context.read<WorkspaceBloc>().add(UpdateProjectVideoDataEvent(importState.videoData));
            context.read<ImportBloc>().add(ResetImportEvent());
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Tải video lên phòng thành công! Bấm "Dịch thuật Video" để AI bắt đầu dịch.'),
                backgroundColor: AppColors.primary,
              ),
            );
          }
        },
        child: BlocBuilder<WorkspaceBloc, WorkspaceState>(
          builder: (context, state) {
            final bool isProjectEmpty = state.videoData['videoUrl'] == null || state.videoData['videoUrl'].toString().isEmpty;
            if (isProjectEmpty) {
              return _buildEmptyRoomUploader(context, state);
            }
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
      ),
    );
  }

  Widget _buildEmptyRoomUploader(BuildContext context, WorkspaceState workspaceState) {
    return BlocBuilder<ImportBloc, ImportState>(
      builder: (context, importState) {
        final bool isProcessing = importState is ImportUploading;

        return Scaffold(
          appBar: AppBar(
            title: Text('Phòng trống — ${workspaceState.videoData['projectName'] ?? 'Dự án'}'),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () {
                Navigator.of(context).pushReplacementNamed('/');
              },
            ),
          ),
          body: Center(
            child: Container(
              width: 500,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: const Color(0xFF171923),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.folder_open_rounded, size: 64, color: AppColors.primary),
                  const SizedBox(height: 20),
                  const Text(
                    'Phòng biên tập chưa có video',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Vui lòng chọn tệp video (.mp4, .mov) để tải lên phòng làm việc.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: AppColors.textMuted, height: 1.4),
                  ),
                  const SizedBox(height: 24),

                  if (importState is ImportInitial) ...[
                    _buildUploadZonePlaceholder(context, isProcessing),
                  ] else if (importState is ImportFileSelected) ...[
                    _buildFileZoneDetails(context, importState.file),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: isProcessing ? null : () {
                        context.read<ImportBloc>().add(const UploadVideoOnlyEvent());
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('TẢI VIDEO LÊN PHÒNG', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ] else if (importState is ImportUploading) ...[
                    _buildUploadProgressIndicator(
                      title: 'Đang tải video lên phòng...',
                      subtitle: '${(importState.progress * 100).toStringAsFixed(0)}%',
                      value: importState.progress,
                    ),
                  ] else if (importState is ImportFailure) ...[
                    _buildUploadFailureCard(context, importState.error),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildUploadZonePlaceholder(BuildContext context, bool disabled) {
    return InkWell(
      onTap: disabled ? null : () => _pickVideoForRoom(context),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 140,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_upload_outlined, size: 40, color: AppColors.textMuted),
            SizedBox(height: 12),
            Text(
              'Chọn video từ thiết bị',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickVideoForRoom(BuildContext context) async {
    final FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.video,
      allowMultiple: false,
    );

    if (result != null) {
      final platformFile = result.files.single;
      final xFile = XFile(
        kIsWeb ? '' : (platformFile.path ?? ''),
        bytes: platformFile.bytes,
        name: platformFile.name,
        length: platformFile.size,
      );
      if (context.mounted) {
        context.read<ImportBloc>().add(SelectVideoEvent(xFile));
      }
    }
  }

  Widget _buildFileZoneDetails(BuildContext context, XFile file) {
    return Row(
      children: [
        const Icon(Icons.movie, color: AppColors.primary, size: 32),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                file.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 2),
              FutureBuilder<int>(
                future: file.length(),
                builder: (context, snapshot) {
                  final size = snapshot.data ?? 0;
                  return Text(
                    _getFileSizeString(size),
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                  );
                },
              ),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.close, color: Colors.grey, size: 20),
          onPressed: () {
            context.read<ImportBloc>().add(ResetImportEvent());
          },
        ),
      ],
    );
  }

  Widget _buildUploadProgressIndicator({
    required String title,
    required String subtitle,
    required double value,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 12),
        LinearProgressIndicator(
          value: value,
          minHeight: 6,
          backgroundColor: AppColors.border,
          valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
        ),
      ],
    );
  }

  Widget _buildUploadFailureCard(BuildContext context, String error) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.error_outline, color: AppColors.error, size: 36),
        const SizedBox(height: 12),
        Text(
          error,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: () {
            context.read<ImportBloc>().add(ResetImportEvent());
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white24,
            foregroundColor: Colors.white,
          ),
          child: const Text('THỬ LẠI'),
        ),
      ],
    );
  }

  String _getFileSizeString(int bytes) {
    if (bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    double doubleBytes = bytes.toDouble();
    while (doubleBytes >= 1024 && i < suffixes.length - 1) {
      doubleBytes /= 1024;
      i++;
    }
    return '${doubleBytes.toStringAsFixed(1)} ${suffixes[i]}';
  }
}
