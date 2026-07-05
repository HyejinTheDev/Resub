import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:file_picker/file_picker.dart';
import 'package:cross_file/cross_file.dart';
import 'package:url_launcher/url_launcher.dart';

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

  // Split Video States
  XFile? _splitFile;
  double _segmentMinutes = 5.0;
  bool _isSplitting = false;
  List<dynamic> _splitSegments = [];
  String _splittingStatus = '';

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
        platformFile.path ?? '',
        bytes: platformFile.bytes,
        name: platformFile.name,
        length: platformFile.size,
      );
      if (context.mounted) {
        context.read<ImportBloc>().add(SelectVideoEvent(xFile));
      }
    }
  }

  Future<void> _pickSplitVideo() async {
    final FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.video,
      allowMultiple: false,
    );

    if (result != null) {
      final platformFile = result.files.single;
      final xFile = XFile(
        platformFile.path ?? '',
        bytes: platformFile.bytes,
        name: platformFile.name,
        length: platformFile.size,
      );
      setState(() {
        _splitFile = xFile;
        _splitSegments = [];
      });
    }
  }

  Future<void> _handleStartSplit() async {
    final file = _splitFile;
    if (file == null) return;

    setState(() {
      _isSplitting = true;
      _splittingStatus = 'Đang tải video lên: 0%';
      _splitSegments = [];
    });

    try {
      final repository = context.read<ImportBloc>().videoRepository;
      final result = await repository.splitVideo(
        file,
        _segmentMinutes,
        onSendProgress: (sent, total) {
          if (total > 0) {
            final percent = (sent / total * 100).toStringAsFixed(0);
            setState(() {
              _splittingStatus = sent < total
                  ? 'Đang tải video lên: $percent%'
                  : 'Đang phân chia video bằng FFmpeg (không nén)...';
            });
          }
        },
      );

      setState(() {
        _splitSegments = result['segments'] ?? [];
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Chia nhỏ video thành ${_splitSegments.length} phần thành công!'),
            backgroundColor: AppColors.primary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      setState(() {
        _isSplitting = false;
      });
    }
  }

  void _loadSegment(String filePath) {
    context.read<ImportBloc>().add(LoadSegmentAndTranscribeEvent(
          filePath: filePath,
          geminiKey: _useSystemPool ? null : _apiKeyController.text,
          useSystemPool: _useSystemPool,
        ));
  }

  Future<void> _downloadSegment(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
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
        return LayoutBuilder(
          builder: (context, constraints) {
            final bool isDesktop = constraints.maxWidth > 900;

            final Widget splitterCard = _buildSplitterCard(context, state);
            final Widget importCard = _buildImportCard(context, state);

            if (isDesktop) {
              return SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Center(
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 1200),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: splitterCard),
                        const SizedBox(width: 24),
                        Expanded(child: importCard),
                      ],
                    ),
                  ),
                ),
              );
            } else {
              return SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    splitterCard,
                    const SizedBox(height: 20),
                    importCard,
                  ],
                ),
              );
            }
          },
        );
      },
    );
  }

  Widget _buildSplitterCard(BuildContext context, ImportState state) {
    final bool isProcessing = state is ImportUploading || state is ImportTranscribing;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.content_cut, color: AppColors.primary, size: 24),
                const SizedBox(width: 10),
                const Text(
                  'Cắt nhỏ video dài',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Chia nhỏ tệp video dài thành các phần đều nhau liên tục (sử dụng FFmpeg copy trực tiếp, không nén lại nên cực kỳ nhanh và giữ nguyên 100% chất lượng gốc).',
              style: TextStyle(fontSize: 13, color: AppColors.textMuted, height: 1.4),
            ),
            const SizedBox(height: 24),

            if (!_isSplitting && _splitSegments.isEmpty) ...[
              InkWell(
                onTap: isProcessing ? null : _pickSplitVideo,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  height: 150,
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.white.withValues(alpha: 0.01),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.folder_open, size: 40, color: AppColors.textMuted),
                      const SizedBox(height: 10),
                      Text(
                        _splitFile != null ? 'Đã chọn: ${_splitFile!.name}' : 'Kéo thả hoặc chọn file video cần cắt nhỏ',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Hỗ trợ MP4, MKV, AVI, v.v.',
                        style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ),
              if (_splitFile != null) ...[
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Thời lượng mỗi phần:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 80,
                      height: 36,
                      child: TextField(
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 13),
                        decoration: InputDecoration(
                          contentPadding: EdgeInsets.zero,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                        controller: TextEditingController(text: _segmentMinutes.toString()),
                        onChanged: (val) {
                          _segmentMinutes = double.tryParse(val) ?? 5.0;
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('phút', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                  ],
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: isProcessing ? null : _handleStartSplit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                  ),
                  child: const Text('BẮT ĐẦU CẮT VIDEO'),
                ),
              ]
            ] else if (_isSplitting) ...[
              Container(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Column(
                  children: [
                    const CircularProgressIndicator(color: AppColors.primary),
                    const SizedBox(height: 16),
                    Text(
                      _splittingStatus,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              )
            ] else if (_splitSegments.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Kết quả: ${_splitSegments.length} phần',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _splitFile = null;
                        _splitSegments = [];
                      });
                    },
                    child: const Text('Cắt video khác', style: TextStyle(decoration: TextDecoration.underline)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _splitSegments.length,
                separatorBuilder: (context, idx) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final seg = _splitSegments[index];
                  final double duration = (seg['duration'] as num?)?.toDouble() ?? 0.0;
                  final durationStr = '${(duration / 60).floor()}p ${(duration % 60).round()}s';

                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.02),
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                seg['fileName'] ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Thời lượng: $durationStr',
                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Row(
                          children: [
                            ElevatedButton(
                              onPressed: () => _downloadSegment(seg['url']),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                minimumSize: Size.zero,
                                backgroundColor: Colors.white.withValues(alpha: 0.05),
                              ),
                              child: const Text('Tải về', style: TextStyle(fontSize: 11)),
                            ),
                            const SizedBox(width: 6),
                            ElevatedButton(
                              onPressed: isProcessing ? null : () => _loadSegment(seg['filePath']),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                minimumSize: Size.zero,
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.black,
                              ),
                              child: const Text('Lồng tiếng', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              )
            ]
          ],
        ),
      ),
    );
  }

  Widget _buildImportCard(BuildContext context, ImportState state) {
    final bool isProcessing = state is ImportUploading || state is ImportTranscribing;

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.mic, color: AppColors.primary, size: 24),
                const SizedBox(width: 10),
                const Text(
                  'Tải video & Dịch lồng tiếng',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Tự động lắng nghe giọng nói tiếng Trung trong tệp video của bạn, dịch thuật sang tiếng Việt bằng Gemini AI và khởi tạo dự án lồng tiếng đồng bộ.',
              style: TextStyle(fontSize: 13, color: AppColors.textMuted, height: 1.4),
            ),
            const SizedBox(height: 24),

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

  Widget _buildFileDetails(XFile file) {
    return Row(
      children: [
        const Icon(Icons.movie_creation, color: AppColors.primary, size: 36),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                file.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 2),
              FutureBuilder<int>(
                future: file.length(),
                builder: (context, snapshot) {
                  final size = snapshot.data ?? 0;
                  return Text(
                    _getFileSizeString(size),
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                  );
                },
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
