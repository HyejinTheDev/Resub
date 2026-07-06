import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/colors.dart';
import '../../../../../domain/repositories/video_repository.dart';
import '../../../../bloc/workspace/workspace_bloc.dart';
import '../../../../bloc/workspace/workspace_state.dart';

class ExportTab extends StatefulWidget {
  const ExportTab({super.key});

  @override
  State<ExportTab> createState() => _ExportTabState();
}

class _ExportTabState extends State<ExportTab> {
  String _quality = 'medium'; // low, medium, high
  String _resolution = '720'; // 1080, 720, 480
  bool _burnSubtitles = true;

  // Local Export State
  bool _isExporting = false;
  double _exportProgress = 0.0;
  String _statusMessage = '';
  String? _downloadUrl;
  Timer? _statusTimer;
  String? _currentExportId;

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }

  // Calculate estimated export time (matching React implementation)
  String _getEstimatedTimeStr(double durationSec) {
    if (durationSec <= 0) return 'Chưa có thông tin video';

    double factor = 0.4; // medium
    if (_quality == 'low') factor = 0.25;
    if (_quality == 'high') factor = 1.2;

    double resMultiplier = 1.0; // 720p
    if (_resolution == '1080') resMultiplier = 1.5;
    if (_resolution == '480') resMultiplier = 0.7;

    double estimateSec = durationSec * factor * resMultiplier;

    if (_burnSubtitles) {
      estimateSec += durationSec * 0.05; // filters overhead
    }

    if (estimateSec < 1.0) estimateSec = 1.0;

    final int minutes = (estimateSec / 60).floor();
    final int seconds = (estimateSec % 60).round();

    if (minutes > 0) {
      return 'Khoảng ~ $minutes phút $seconds giây';
    } else {
      return 'Khoảng ~ $seconds giây';
    }
  }

  Future<void> _startExport(BuildContext context, WorkspaceState state) async {
    final videoRepository = RepositoryProvider.of<VideoRepository>(context);

    // Prepare subtitles array matching backend format
    final List<Map<String, dynamic>> subtitlesJson = state.subtitles.map((sub) {
      return {
        'startTime': sub.startTime,
        'endTime': sub.endTime,
        'chineseText': sub.chineseText,
        'text': sub.text,
        'voice': sub.voice ?? state.defaultVoice,
      };
    }).toList();

    // Prepare masks array
    final List<Map<String, dynamic>> masksJson = state.blurMasks.map((mask) {
      return {
        'startTime': mask.startTime,
        'endTime': mask.endTime,
        'yPercentage': mask.yPercentage,
        'heightPercentage': mask.heightPercentage,
        'xPercentage': mask.xPercentage,
        'widthPercentage': mask.widthPercentage,
        'blurRadius': mask.blurRadius,
        'color': mask.color,
        'opacity': mask.opacity,
        'enabled': mask.enabled,
      };
    }).toList();

    // Combined payload
    final Map<String, dynamic> payload = {
      'videoPath': state.videoData['videoPath'] ?? '',
      'audioPath': state.videoData['audioPath'] ?? '',
      'subtitles': subtitlesJson,
      'blurMasks': masksJson,
      'bgVolume': state.bgVolume,
      'ttsVolume': state.ttsVolume,
      'defaultVoice': state.defaultVoice,
      'capcutCookie': state.capcutCookie,
      'quality': _quality,
      'resolution': _resolution,
      'burnSubtitles': _burnSubtitles,
    };

    setState(() {
      _isExporting = true;
      _exportProgress = 0.0;
      _statusMessage = 'Đang gửi yêu cầu xuất video...';
      _downloadUrl = null;
    });

    try {
      final exportId = await videoRepository.startDubbing(payload);
      _currentExportId = exportId;
      _pollStatus(videoRepository, exportId);
    } catch (e) {
      setState(() {
        _isExporting = false;
        _statusMessage = 'Lỗi xuất video: ${e.toString()}';
      });
    }
  }

  void _pollStatus(VideoRepository videoRepository, String exportId) {
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(const Duration(seconds: 2), (timer) async {
      try {
        final progress = await videoRepository.getDubbingProgress(exportId);
        final String status = progress['status'] ?? 'pending';
        final int percent = progress['percent'] ?? 0;
        final String msg = progress['message'] ?? 'Đang render...';

        if (status == 'done') {
          timer.cancel();
          setState(() {
            _isExporting = false;
            _exportProgress = 1.0;
            _statusMessage = 'Xuất video hoàn tất!';
            _downloadUrl = progress['videoUrl'];
          });
        } else if (status == 'error') {
          timer.cancel();
          setState(() {
            _isExporting = false;
            _statusMessage = progress['error'] ?? 'Lỗi kết xuất FFmpeg từ máy chủ';
          });
        } else {
          setState(() {
            _exportProgress = percent / 100.0;
            _statusMessage = msg;
          });
        }
      } catch (e) {
        // Continue polling despite temporary network slips
        setState(() {
          _statusMessage = 'Đang kết nối lại máy chủ...';
        });
      }
    });
  }

  Future<void> _cancelExport(BuildContext context) async {
    final exportId = _currentExportId;
    if (exportId == null) return;

    final videoRepository = RepositoryProvider.of<VideoRepository>(context);
    _statusTimer?.cancel();

    try {
      await videoRepository.cancelDubbing(exportId);
    } catch (_) {}

    setState(() {
      _isExporting = false;
      _exportProgress = 0.0;
      _statusMessage = 'Đã hủy xuất video.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        final double durationSec = state.videoDurationMs / 1000.0;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Section 1: Settings
              const Text(
                'TÙY CHỌN ĐẦU RA VIDEO',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),

              // Quality preset dropdown
              DropdownButtonFormField<String>(
                initialValue: _quality,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Chất lượng nén video',
                ),
                dropdownColor: AppColors.surface,
                items: const [
                  DropdownMenuItem(value: 'low', child: Text('Thấp (Nhanh nhất - ultrafast)', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: 'medium', child: Text('Trung bình (Cân bằng - superfast)', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: 'high', child: Text('Cao (Tốt nhất - medium)', style: TextStyle(color: Colors.white))),
                ],
                onChanged: _isExporting
                    ? null
                    : (val) {
                        if (val != null) {
                          setState(() {
                            _quality = val;
                          });
                        }
                      },
              ),
              const SizedBox(height: 16),

              // Resolution dropdown
              DropdownButtonFormField<String>(
                initialValue: _resolution,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Độ phân giải video',
                ),
                dropdownColor: AppColors.surface,
                items: const [
                  DropdownMenuItem(value: '1080', child: Text('FullHD 1080p', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: '720', child: Text('HD 720p', style: TextStyle(color: Colors.white))),
                  DropdownMenuItem(value: '480', child: Text('SD 480p', style: TextStyle(color: Colors.white))),
                ],
                onChanged: _isExporting
                    ? null
                    : (val) {
                        if (val != null) {
                          setState(() {
                            _resolution = val;
                          });
                        }
                      },
              ),
              const SizedBox(height: 16),

              // Burn subtitles toggle
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Chèn phụ đề cứng lên video'),
                  Switch(
                    value: _burnSubtitles,
                    activeThumbColor: AppColors.primary,
                    onChanged: _isExporting
                        ? null
                        : (val) {
                            setState(() {
                              _burnSubtitles = val;
                            });
                          },
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
              const Divider(color: AppColors.border),
              const SizedBox(height: 12),

              // Section 2: Render Progress & Action Buttons
              if (!_isExporting && _downloadUrl == null) ...[
                // Time Estimate Box
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.timer_outlined, color: AppColors.warning),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Thời gian xuất dự kiến:',
                              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _getEstimatedTimeStr(durationSec),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                
                // Export Button
                ElevatedButton(
                  onPressed: () => _startExport(context, state),
                  child: const Text('BẮT ĐẦU XUẤT VIDEO DỊCH'),
                ),
                
                if (_statusMessage.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    _statusMessage,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.error, fontSize: 12),
                  ),
                ],
              ] else if (_isExporting) ...[
                // Render progress card
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Đang xử lý ghép phụ đề & giọng đọc...',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      value: _exportProgress,
                      minHeight: 8,
                      backgroundColor: AppColors.border,
                      valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${(_exportProgress * 100).toStringAsFixed(0)}% — $_statusMessage',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 20),
                    OutlinedButton(
                      onPressed: () => _cancelExport(context),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                      ),
                      child: const Text('HỦY XUẤT VIDEO'),
                    ),
                  ],
                ),
              ] else if (_downloadUrl != null) ...[
                // Success / Download card
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.check_circle, color: AppColors.primary, size: 48),
                    const SizedBox(height: 12),
                    const Text(
                      'Xuất Video Thành Công!',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                      ),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: _downloadUrl!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Đã sao chép liên kết tải video vào bộ nhớ tạm!'),
                            backgroundColor: AppColors.primary,
                          ),
                        );
                      },
                      child: const Text('SAO CHÉP LIÊN KẾT TẢI VIDEO'),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _downloadUrl!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _downloadUrl = null;
                          _statusMessage = '';
                        });
                      },
                      child: const Text('Quay lại tùy chọn xuất'),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
