import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:file_picker/file_picker.dart';
import 'package:cross_file/cross_file.dart';
import 'package:flutter/foundation.dart';

import '../../../../../core/constants/colors.dart';
import '../../../../bloc/import/import_bloc.dart';
import '../../../../bloc/import/import_event.dart';
import '../../../../bloc/import/import_state.dart';
import '../../../../bloc/workspace/workspace_bloc.dart';
import '../../../../bloc/workspace/workspace_event.dart';

class UploadTab extends StatefulWidget {
  const UploadTab({super.key});

  @override
  State<UploadTab> createState() => _UploadTabState();
}

class _UploadTabState extends State<UploadTab> {
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
    return BlocConsumer<ImportBloc, ImportState>(
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

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'TẢI VIDEO MỚI LÊN WORKSPACE',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),

              if (state is ImportInitial) ...[
                _buildUploadPlaceholder(context, isProcessing),
              ] else if (state is ImportFileSelected) ...[
                _buildFileDetails(context, state.file),
                _buildSettingsForm(isProcessing),
                const SizedBox(height: 20),
                _buildStartButton(context, isProcessing),
              ] else if (state is ImportUploading) ...[
                _buildProgressCard(
                  title: 'Đang tải video lên...',
                  subtitle: '${(state.progress * 100).toStringAsFixed(0)}%',
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
        );
      },
    );
  }

  Widget _buildUploadPlaceholder(BuildContext context, bool disabled) {
    return InkWell(
      onTap: disabled ? null : () => _pickVideo(context),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 150,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_upload, size: 40, color: AppColors.primary),
            SizedBox(height: 12),
            Text(
              'Nhấp để chọn video mới',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 4),
            Text(
              'Định dạng .mp4, .mov (Tối đa 5 phút)',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileDetails(BuildContext context, XFile file) {
    return Row(
      children: [
        const Icon(Icons.movie_creation, color: AppColors.primary, size: 32),
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

  Widget _buildSettingsForm(bool disabled) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 24, color: AppColors.border),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Dùng Key hệ thống',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
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
            'Nhập API Key AI:',
            style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _apiKeyController,
            enabled: !disabled,
            obscureText: true,
            style: const TextStyle(fontSize: 13),
            decoration: const InputDecoration(
              hintText: 'AIzaSy...',
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStartButton(BuildContext context, bool disabled) {
    return ElevatedButton(
      onPressed: disabled
          ? null
          : () {
              context.read<ImportBloc>().add(StartUploadAndTranscribeEvent(
                    geminiKey: _useSystemPool ? null : _apiKeyController.text,
                    useSystemPool: _useSystemPool,
                  ));
            },
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.black,
      ),
      child: const Text('BẮT ĐẦU DỊCH VIDEO', style: TextStyle(fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildProgressCard({
    required String title,
    required String subtitle,
    required double value,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
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
      ),
    );
  }

  Widget _buildSuccessCard(BuildContext context, ImportSuccess state) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.check_circle_outline, color: AppColors.primary, size: 48),
          const SizedBox(height: 12),
          const Text(
            'Dịch Video Thành Công!',
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 6),
          Text(
            'Đã dịch xong ${state.subtitles.length} câu phụ đề.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              context.read<WorkspaceBloc>().add(InitializeWorkspaceEvent(
                    subtitles: state.subtitles,
                    detectedY: state.detectedY,
                    detectedHeight: state.detectedHeight,
                    videoData: state.videoData,
                  ));
              context.read<ImportBloc>().add(ResetImportEvent());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
            ),
            child: const Text('NẠP VIDEO VÀO WORKSPACE', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildFailureCard(BuildContext context, String error) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 48),
          const SizedBox(height: 12),
          const Text(
            'Lỗi Dịch Thuật',
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.error),
          ),
          const SizedBox(height: 8),
          Text(
            error,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 20),
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
      ),
    );
  }
}
