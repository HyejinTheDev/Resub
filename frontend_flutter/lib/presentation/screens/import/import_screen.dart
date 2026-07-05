import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:file_picker/file_picker.dart';

import '../../../core/constants/colors.dart';
import '../../bloc/import/import_bloc.dart';
import '../../bloc/import/import_event.dart';
import '../../bloc/import/import_state.dart';
import '../../bloc/workspace/workspace_bloc.dart';
import '../../bloc/workspace/workspace_event.dart';
import '../workspace/workspace_screen.dart';

class ImportScreen extends StatefulWidget {
  const ImportScreen({super.key});

  @override
  State<ImportScreen> createState() => _ImportScreenState();
}

class _ImportScreenState extends State<ImportScreen> {
  final TextEditingController _apiKeyController = TextEditingController();
  bool _useSystemPool = true;

  @override
  void dispose() {
    _apiKeyController.dispose();
    super.dispose();
  }

  Future<void> _pickVideo(BuildContext context) async {
    final FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.video,
      allowMultiple: false,
    );

    if (result != null && result.files.single.path != null) {
      final file = File(result.files.single.path!);
      if (context.mounted) {
        context.read<ImportBloc>().add(SelectVideoEvent(file));
      }
    }
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('RESUB — Tự Động Lồng Tiếng AI'),
      ),
      body: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 500),
          padding: const EdgeInsets.all(24.0),
          child: BlocConsumer<ImportBloc, ImportState>(
            listener: (context, state) {
              if (state is ImportFailure) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(state.error),
                    backgroundColor: AppColors.error,
                  ),
                );
              }
            },
            builder: (context, state) {
              final bool isProcessing = state is ImportUploading || state is ImportTranscribing;

              return Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo/Header Area
                  Icon(
                    Icons.auto_awesome,
                    size: 64,
                    color: AppColors.primary,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Dịch và Thuyết Minh Video',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Hỗ trợ nhận dạng phụ đề tiếng Trung, dịch nghĩa và lồng tiếng Việt tức thì bằng AI.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // main interaction card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (state is ImportInitial) ...[
                            _buildUploadPlaceholder(context),
                          ] else if (state is ImportFileSelected) ...[
                            _buildFileDetails(state.file),
                            const SizedBox(height: 16),
                            _buildSettingsForm(isProcessing),
                            const SizedBox(height: 20),
                            _buildStartButton(context),
                          ] else if (state is ImportUploading) ...[
                            _buildProgressCard(
                              title: 'Đang tải lên video...',
                              subtitle: '${(state.progress * 100).toStringAsFixed(1)}%',
                              value: state.progress,
                            ),
                          ] else if (state is ImportTranscribing) ...[
                            _buildProgressCard(
                              title: 'AI đang dịch thuật & lồng tiếng...',
                              subtitle: '${state.percent}% — ${state.message}',
                              value: state.percent / 100,
                            ),
                          ] else if (state is ImportSuccess) ...[
                            _buildSuccessCard(context, state),
                          ] else if (state is ImportFailure) ...[
                            _buildFailureCard(context, state.error),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildUploadPlaceholder(BuildContext context) {
    return InkWell(
      onTap: () => _pickVideo(context),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 150,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.video_library, size: 48, color: AppColors.textMuted),
            SizedBox(height: 12),
            Text(
              'Chọn video từ thiết bị',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 4),
            Text(
              'Hỗ trợ các định dạng .mp4, .mov (Tối đa 5 phút)',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileDetails(File file) {
    final fileName = file.path.split(Platform.pathSeparator).last;
    final int size = file.lengthSync();

    return Row(
      children: [
        const Icon(Icons.movie_creation, color: AppColors.primary, size: 36),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                fileName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 2),
              Text(
                _getFileSizeString(size),
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.close, color: Colors.grey),
          onPressed: () {
            context.read<ImportBloc>().add(ResetImportEvent());
          },
        ),
      ],
    );
  }

  Widget _buildSettingsForm(bool disabled) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 24, color: AppColors.border),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Sử dụng kho Key hệ thống',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            Switch(
              value: _useSystemPool,
              activeThumbColor: AppColors.primary,
              onChanged: disabled
                  ? null
                  : (val) {
                      setState(() {
                        _useSystemPool = val;
                      });
                    },
            ),
          ],
        ),
        if (!_useSystemPool) ...[
          const SizedBox(height: 12),
          const Text(
            'Nhập API Key Gemini của bạn:',
            style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _apiKeyController,
            enabled: !disabled,
            obscureText: true,
            decoration: const InputDecoration(
              hintText: 'AIzaSy...',
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStartButton(BuildContext context) {
    return ElevatedButton(
      onPressed: () {
        context.read<ImportBloc>().add(StartUploadAndTranscribeEvent(
              geminiKey: _useSystemPool ? null : _apiKeyController.text,
              useSystemPool: _useSystemPool,
            ));
      },
      child: const Text('BẮT ĐẦU DỊCH VIDEO'),
    );
  }

  Widget _buildProgressCard({
    required String title,
    required String subtitle,
    required double value,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
        ),
        const SizedBox(height: 12),
        LinearProgressIndicator(
          value: value,
          minHeight: 8,
          backgroundColor: AppColors.border,
          valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildSuccessCard(BuildContext context, ImportSuccess state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.check_circle_outline, color: AppColors.primary, size: 56),
        const SizedBox(height: 16),
        const Text(
          'Dịch Video Thành Công!',
          textAlign: TextAlign.center,
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 8),
        Text(
          'Đã tạo thành công ${state.subtitles.length} câu thuyết minh.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            context.read<WorkspaceBloc>().add(InitializeWorkspaceEvent(
                  subtitles: state.subtitles,
                  detectedY: state.detectedY,
                  detectedHeight: state.detectedHeight,
                  videoData: state.videoData,
                ));
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (context) => const WorkspaceScreen(),
              ),
            );
          },
          child: const Text('TIẾP TỤC VÀO PHÒNG LÀM VIỆC'),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () {
            context.read<ImportBloc>().add(ResetImportEvent());
          },
          child: const Text('Chọn video khác'),
        ),
      ],
    );
  }

  Widget _buildFailureCard(BuildContext context, String error) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.error_outline, color: AppColors.error, size: 56),
        const SizedBox(height: 16),
        const Text(
          'Quá Trình Xử Lý Gặp Lỗi',
          textAlign: TextAlign.center,
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 8),
        Text(
          error,
          textAlign: TextAlign.center,
          maxLines: 4,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            context.read<ImportBloc>().add(ResetImportEvent());
          },
          child: const Text('THỬ LẠI'),
        ),
      ],
    );
  }
}
