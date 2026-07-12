import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:video_player/video_player.dart';

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

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        final subtitles = state.subtitles;

        if (subtitles.isEmpty) {
          return BlocConsumer<ImportBloc, ImportState>(
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
          );
        }

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

        return Container(
          color: AppColors.background,
          child: Column(
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
                                    // Jump/Play button
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
                                    // TTS Voice preview
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
                                    // Delete card
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
          ),
        );
      },
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
