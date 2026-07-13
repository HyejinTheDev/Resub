import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:video_player/video_player.dart';
import 'package:file_picker/file_picker.dart';
import 'package:cross_file/cross_file.dart';
import 'package:flutter/foundation.dart';

import '../../../../core/constants/colors.dart';
import '../../../../domain/repositories/video_repository.dart';
import '../../../bloc/workspace/workspace_bloc.dart';
import '../../../bloc/workspace/workspace_event.dart';
import '../../../bloc/workspace/workspace_state.dart';

import '../../../bloc/import/import_bloc.dart';
import '../../../bloc/import/import_event.dart';
import '../../../bloc/import/import_state.dart';

class SubtitleListPanel extends StatefulWidget {
  const SubtitleListPanel({super.key});

  @override
  State<SubtitleListPanel> createState() => _SubtitleListPanelState();
}

class _SubtitleListPanelState extends State<SubtitleListPanel> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  int _previewLoadingIndex = -1;
  VideoPlayerController? _previewAudioController;
  int _currentTab = 0; // 0 = Phương tiện (Media), 1 = Phụ đề (Subtitles)

  final List<Map<String, String>> _voices = [
    {'value': 'vi-VN-HoaiMyNeural', 'label': 'Hoài My (Nữ miền Nam)'},
    {'value': 'vi-VN-NamMinhNeural', 'label': 'Nam Minh (Nam miền Nam)'},
    {'value': 'capcut-cogaihoatngon', 'label': 'Cô Gái Hoạt Ngôn (CapCut)'},
    {'value': 'capcut-nhongotngao', 'label': 'Nhỏ Ngọt Ngào (CapCut)'},
    {'value': 'capcut-nuphothong', 'label': 'Nữ Phổ Thông (CapCut)'},
    {'value': 'capcut-giongbe', 'label': 'Giọng Bé (CapCut)'},
    {'value': 'capcut-vietmeo', 'label': 'Việt Méo (CapCut)'},
    {'value': 'capcut-kennydaide', 'label': 'Kenny Đại Đế (CapCut)'},
  ];

  @override
  void dispose() {
    _searchController.dispose();
    _previewAudioController?.dispose();
    super.dispose();
  }

  int _parseTimeToMs(String timeStr) {
    final match = RegExp(r'(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?').firstMatch(timeStr);
    if (match == null) return 0;
    final m = int.tryParse(match.group(1) ?? '0') ?? 0;
    final s = int.tryParse(match.group(2) ?? '0') ?? 0;
    final ms = int.tryParse(match.group(3) ?? '0') ?? 0;
    return m * 60 * 1000 + s * 1000 + ms;
  }

  Future<void> _handlePreviewVoice(int index, String text, String voice, String cookie) async {
    if (text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nội dung phụ đề trống, không thể nghe thử!'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() {
      _previewLoadingIndex = index;
    });

    try {
      final repository = context.read<VideoRepository>();
      final audioUrl = await repository.ttsPreview(
        text: text,
        voice: voice,
        capcutCookie: cookie,
      );

      _previewAudioController?.dispose();
      _previewAudioController = VideoPlayerController.networkUrl(Uri.parse(audioUrl));
      await _previewAudioController!.initialize();
      await _previewAudioController!.play();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Nghe thử thất bại: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _previewLoadingIndex = -1;
        });
      }
    }
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

  Widget _buildUploadZonePlaceholder(BuildContext context, bool disabled) {
    return InkWell(
      onTap: disabled ? null : () => _pickVideoForRoom(context),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 140,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white24, style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(8),
          color: const Color(0xFF1E202C).withValues(alpha: 0.2),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary,
              ),
              child: const Icon(Icons.add, size: 24, color: Colors.black),
            ),
            const SizedBox(height: 12),
            const Text(
              'Nhập',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 4),
            const Text(
              'Kéo thả hoặc nhấp chọn video',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
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
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
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
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
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
      mainAxisAlignment: MainAxisAlignment.center,
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

  Widget _buildMediaAssetList(BuildContext context, WorkspaceState state) {
    final String videoName = state.videoData['videoName'] ?? 'Video gốc.mp4';
    final bool addedToTimeline = state.videoData['addedToTimeline'] == true;

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Tất cả phương tiện',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textMuted),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E202C),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.video_library_rounded, size: 36, color: AppColors.primary),
                        SizedBox(height: 4),
                        Text(
                          'VIDEO',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ],
                    ),
                  ),
                  if (addedToTimeline)
                    Positioned(
                      top: 4,
                      left: 4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0072FF),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'đã thêm',
                          style: TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  if (!addedToTimeline)
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.black45,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Center(
                          child: InkWell(
                            onTap: () {
                              context.read<WorkspaceBloc>().add(const AddVideoToTimelineEvent());
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Đã thêm video xuống dòng thời gian!'),
                                  backgroundColor: AppColors.primary,
                                ),
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.primary,
                              ),
                              child: const Icon(Icons.add, size: 20, color: Colors.black),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      videoName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      addedToTimeline ? 'Trạng thái: Đã thêm vào dòng thời gian' : 'Trạng thái: Chưa thêm vào dòng thời gian',
                      style: TextStyle(fontSize: 10, color: addedToTimeline ? AppColors.primary : Colors.amber),
                    ),
                    const SizedBox(height: 12),
                    if (!addedToTimeline)
                      ElevatedButton.icon(
                        icon: const Icon(Icons.add, size: 14, color: Colors.black),
                        label: const Text('Thêm vào Timeline', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          minimumSize: Size.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                        onPressed: () {
                          context.read<WorkspaceBloc>().add(const AddVideoToTimelineEvent());
                        },
                      )
                    else
                      ElevatedButton.icon(
                        icon: const Icon(Icons.translate, size: 14, color: Colors.black),
                        label: const Text('Chuyển sang Phụ đề', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          minimumSize: Size.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                        onPressed: () {
                          setState(() {
                            _currentTab = 1;
                          });
                        },
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ImportBloc, ImportState>(
      listener: (context, importState) {
        if (importState is ImportUploadSuccess) {
          context.read<WorkspaceBloc>().add(UpdateProjectVideoDataEvent(importState.videoData));
          context.read<ImportBloc>().add(ResetImportEvent());
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Tải video lên phòng thành công! Bấm nút "+" trên video để đưa xuống dòng thời gian.'),
              backgroundColor: AppColors.primary,
            ),
          );
        }
      },
      child: BlocBuilder<WorkspaceBloc, WorkspaceState>(
        builder: (context, state) {
          final subtitles = state.subtitles;
          final String videoUrl = state.videoData['videoUrl'] ?? '';
          final bool addedToTimeline = state.videoData['addedToTimeline'] == true;

          return Container(
            color: AppColors.background,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Custom Tab Bar (Phương tiện & Phụ đề)
                Container(
                  color: const Color(0xFF141418),
                  child: Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _currentTab = 0),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _currentTab == 0 ? AppColors.primary : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Text(
                              'Phương tiện',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _currentTab == 0 ? AppColors.primary : Colors.white60,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _currentTab = 1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              border: Border(
                                bottom: BorderSide(
                                  color: _currentTab == 1 ? AppColors.primary : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Text(
                              'Phụ đề',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _currentTab == 1 ? AppColors.primary : Colors.white60,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Active Tab Content
                Expanded(
                  child: _currentTab == 0
                      // TAB 0: Phương tiện
                      ? (videoUrl.isEmpty
                          ? BlocBuilder<ImportBloc, ImportState>(
                              builder: (context, importState) {
                                final bool isProcessing = importState is ImportUploading;
                                return Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      if (importState is ImportInitial || importState is ImportFailure) ...[
                                        _buildUploadZonePlaceholder(context, isProcessing),
                                        if (importState is ImportFailure) ...[
                                          const SizedBox(height: 16),
                                          _buildUploadFailureCard(context, importState.error),
                                        ],
                                      ] else if (importState is ImportFileSelected) ...[
                                        _buildFileZoneDetails(context, importState.file),
                                        const SizedBox(height: 20),
                                        ElevatedButton(
                                          onPressed: isProcessing
                                              ? null
                                              : () {
                                                  context.read<ImportBloc>().add(const UploadVideoOnlyEvent());
                                                },
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: AppColors.primary,
                                            foregroundColor: Colors.black,
                                            padding: const EdgeInsets.symmetric(vertical: 12),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                          ),
                                          child: const Text('TẢI VIDEO LÊN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                        ),
                                      ] else if (importState is ImportUploading) ...[
                                        _buildUploadProgressIndicator(
                                          title: 'Đang tải video lên...',
                                          subtitle: '${(importState.progress * 100).toStringAsFixed(0)}%',
                                          value: importState.progress,
                                        ),
                                      ],
                                    ],
                                  ),
                                );
                              },
                            )
                          : _buildMediaAssetList(context, state))

                      // TAB 1: Phụ đề
                      : (videoUrl.isEmpty
                          ? const Center(
                              child: Text(
                                'Vui lòng nhập video trước khi dịch',
                                style: TextStyle(color: Colors.white30, fontSize: 13, fontStyle: FontStyle.italic),
                              ),
                            )
                          : (!addedToTimeline
                              ? Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.playlist_add_circle_outlined, size: 48, color: Colors.white24),
                                      const SizedBox(height: 12),
                                      const Text(
                                        'Kéo video xuống dòng thời gian',
                                        style: TextStyle(color: Colors.white60, fontSize: 13, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 6),
                                      const Text(
                                        'để kích hoạt tính năng dịch lồng tiếng',
                                        style: TextStyle(color: Colors.white30, fontSize: 11),
                                      ),
                                      const SizedBox(height: 16),
                                      ElevatedButton(
                                        onPressed: () {
                                          context.read<WorkspaceBloc>().add(const AddVideoToTimelineEvent());
                                        },
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppColors.primary,
                                          foregroundColor: Colors.black,
                                        ),
                                        child: const Text('Thêm vào dòng thời gian'),
                                      ),
                                    ],
                                  ),
                                )
                              : (subtitles.isEmpty
                                  ? BlocConsumer<ImportBloc, ImportState>(
                                      listener: (context, importState) {
                                        if (importState is ImportSuccess) {
                                          context.read<WorkspaceBloc>().add(InitializeWorkspaceEvent(
                                                subtitles: importState.subtitles,
                                                detectedY: importState.detectedY,
                                                detectedHeight: importState.detectedHeight,
                                                videoData: state.videoData,
                                              ));
                                          context.read<ImportBloc>().add(ResetImportEvent());
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('Dịch video bằng AI thành công!'),
                                              backgroundColor: AppColors.primary,
                                            ),
                                          );
                                        }
                                      },
                                      builder: (context, importState) {
                                        if (importState is ImportTranscribing) {
                                          return _buildTranscribingProgress(importState);
                                        }
                                        if (importState is ImportFailure) {
                                          return _buildDubbingFailure(context, importState.error);
                                        }
                                        return _buildStartTranslationPlaceholder(context, state.videoData);
                                      },
                                    )
                                  : _buildSubtitleListSection(context, state)))),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSubtitleListSection(BuildContext context, WorkspaceState state) {
    final subtitles = state.subtitles;
    final filteredList = subtitles.asMap().entries.where((entry) {
      final query = _searchQuery.trim().toLowerCase();
      if (query.isEmpty) return true;

      final sub = entry.value;
      final matchText = sub.text.toLowerCase().contains(query) ||
          sub.chineseText.toLowerCase().contains(query) ||
          sub.startTime.toLowerCase().contains(query) ||
          sub.endTime.toLowerCase().contains(query);

      if (matchText) return true;

      // Check if numeric query fits in seconds range
      final querySecs = double.tryParse(query);
      if (querySecs != null) {
        final start = _parseTimeToMs(sub.startTime) / 1000.0;
        final end = _parseTimeToMs(sub.endTime) / 1000.0;
        if (querySecs >= start && querySecs <= end) {
          return true;
        }
      }

      return false;
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Panel Header
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'PHỤ ĐỀ DỊCH THUẬT (${subtitles.length} câu)',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.add, size: 14, color: Colors.black),
                label: const Text('Thêm câu', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: Size.zero,
                ),
                onPressed: () {
                  final currentSec = state.currentTimeMs / 1000.0;
                  context.read<WorkspaceBloc>().add(AddSubtitleEvent(
                        currentTimeSecs: currentSec,
                        defaultVoice: state.defaultVoice,
                      ));
                },
              ),
            ],
          ),
        ),

        // Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: SizedBox(
            height: 38,
            child: TextField(
              controller: _searchController,
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
              },
              style: const TextStyle(fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Tìm chữ hoặc thời gian...',
                prefixIcon: const Icon(Icons.search, size: 16, color: AppColors.textMuted),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 14),
                        onPressed: () {
                          setState(() {
                            _searchController.clear();
                            _searchQuery = '';
                          });
                        },
                      )
                    : null,
                contentPadding: EdgeInsets.zero,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),

        // Subtitles Scroll View
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            itemCount: filteredList.length,
            itemBuilder: (context, idx) {
              final entry = filteredList[idx];
              final index = entry.key;
              final sub = entry.value;
              final bool isSelected = state.selectedSubtitleIndex == index;
              final startMs = _parseTimeToMs(sub.startTime);

              return Card(
                color: isSelected ? const Color(0xFF1E2130) : const Color(0xFF171923),
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: isSelected ? AppColors.primary : AppColors.border,
                    width: isSelected ? 1.5 : 1.0,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Card Header: Index, Times, Controls
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 9,
                                backgroundColor: isSelected ? AppColors.primary : Colors.white12,
                                child: Text(
                                  '${index + 1}',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    color: isSelected ? Colors.black : Colors.white70,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${sub.startTime} ➜ ${sub.endTime}',
                                style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontFamily: 'monospace'),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              IconButton(
                                icon: const Icon(Icons.play_circle_fill, size: 18, color: AppColors.primary),
                                tooltip: 'Nhảy tới thời điểm này',
                                constraints: const BoxConstraints(),
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                onPressed: () {
                                  context.read<WorkspaceBloc>().add(SelectSubtitleEvent(index));
                                  context.read<WorkspaceBloc>().add(RequestSeekEvent(startMs));
                                },
                              ),
                              _previewLoadingIndex == index
                                  ? const SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
                                    )
                                  : IconButton(
                                      icon: const Icon(Icons.volume_up, size: 16, color: Colors.white70),
                                      tooltip: 'Nghe thử giọng đọc',
                                      constraints: const BoxConstraints(),
                                      padding: const EdgeInsets.symmetric(horizontal: 4),
                                      onPressed: () => _handlePreviewVoice(
                                        index,
                                        sub.text,
                                        sub.voice ?? state.defaultVoice,
                                        state.capcutCookie,
                                      ),
                                    ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.error),
                                tooltip: 'Xóa câu',
                                constraints: const BoxConstraints(),
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                onPressed: () {
                                  context.read<WorkspaceBloc>().add(DeleteSubtitleEvent(index));
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Chinese Text Box
                      TextFormField(
                        initialValue: sub.chineseText,
                        style: const TextStyle(fontSize: 12),
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Tiếng Trung gốc',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        onChanged: (val) {
                          context.read<WorkspaceBloc>().add(UpdateSubtitleTextEvent(
                                index: index,
                                text: sub.text,
                                chineseText: val,
                                voice: sub.voice,
                              ));
                        },
                      ),
                      const SizedBox(height: 8),

                      // Vietnamese Text Box
                      TextFormField(
                        initialValue: sub.text,
                        style: const TextStyle(fontSize: 12),
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Dịch tiếng Việt',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        onChanged: (val) {
                          context.read<WorkspaceBloc>().add(UpdateSubtitleTextEvent(
                                index: index,
                                text: val,
                                chineseText: sub.chineseText,
                                voice: sub.voice,
                              ));
                        },
                      ),
                      const SizedBox(height: 8),

                      // Voice Override Dropdown
                      DropdownButtonFormField<String>(
                        initialValue: sub.voice,
                        isDense: true,
                        style: const TextStyle(fontSize: 11, color: Colors.white),
                        decoration: const InputDecoration(
                          labelText: 'Giọng đọc riêng phân đoạn',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                        dropdownColor: AppColors.surface,
                        items: [
                          const DropdownMenuItem<String>(
                            value: null,
                            child: Text('Mặc định hệ thống', style: TextStyle(fontStyle: FontStyle.italic, color: Colors.white)),
                          ),
                          ..._voices.map((voice) {
                            return DropdownMenuItem<String>(
                              value: voice['value'],
                              child: Text(voice['label']!, style: const TextStyle(color: Colors.white)),
                            );
                          }),
                        ],
                        onChanged: (val) {
                          context.read<WorkspaceBloc>().add(UpdateSubtitleTextEvent(
                                index: index,
                                text: sub.text,
                                chineseText: sub.chineseText,
                                voice: val,
                              ));
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStartTranslationPlaceholder(BuildContext context, Map<String, dynamic> videoData) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.translate_rounded, size: 56, color: AppColors.primary),
            const SizedBox(height: 16),
            const Text(
              'Chưa có thuyết minh dịch thuật',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Hãy bấm nút bên dưới để AI tự động nhận dạng giọng nói tiếng Trung và dịch thuật lồng tiếng sang tiếng Việt.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _showStartTranslationDialog(context, videoData),
              icon: const Icon(Icons.auto_awesome, size: 16, color: Colors.black),
              label: const Text(
                'Dịch thuật Video (AI)',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showStartTranslationDialog(BuildContext context, Map<String, dynamic> videoData) {
    bool useSystemPool = true;
    final keyController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Cấu hình dịch thuật AI'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Dùng kho Key hệ thống', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  Switch(
                    value: useSystemPool,
                    activeThumbColor: AppColors.primary,
                    onChanged: (val) {
                      setDialogState(() {
                        useSystemPool = val;
                      });
                    },
                  ),
                ],
              ),
              if (!useSystemPool) ...[
                const SizedBox(height: 12),
                const Text('API Key AI của bạn (Gemini Key):', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                const SizedBox(height: 6),
                TextField(
                  controller: keyController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    hintText: 'AIzaSy...',
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy'),
            ),
            TextButton(
              onPressed: () {
                final videoPath = videoData['videoPath'] ?? '';
                final audioPath = videoData['audioPath'] ?? '';

                if (videoPath.isEmpty || audioPath.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Không tìm thấy đường dẫn video trong phòng!')),
                  );
                  return;
                }

                context.read<ImportBloc>().add(StartTranscriptionOnlyEvent(
                      videoPath: videoPath,
                      audioPath: audioPath,
                      geminiKey: useSystemPool ? null : keyController.text.trim(),
                      useSystemPool: useSystemPool,
                    ));
                
                Navigator.pop(context);
              },
              child: const Text('Bắt đầu dịch', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTranscribingProgress(ImportTranscribing state) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: AppColors.primary),
            const SizedBox(height: 24),
            const Text(
              'AI đang dịch thuật & lồng tiếng...',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: state.percent / 100,
              minHeight: 6,
              backgroundColor: AppColors.border,
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
            ),
            const SizedBox(height: 10),
            Text(
              '${state.percent}% — ${state.message}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDubbingFailure(BuildContext context, String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            const Text(
              'Quá Trình Xử Lý Gặp Lỗi',
              textAlign: TextAlign.center,
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.error),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.4),
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
      ),
    );
  }
}
