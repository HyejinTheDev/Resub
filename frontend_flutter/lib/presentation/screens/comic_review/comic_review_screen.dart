import 'dart:async';
import 'dart:convert';
import 'package:cross_file/cross_file.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/colors.dart';
import '../../../domain/repositories/video_repository.dart';

class ComicReviewScreen extends StatefulWidget {
  const ComicReviewScreen({super.key});

  @override
  State<ComicReviewScreen> createState() => _ComicReviewScreenState();
}

class _ComicReviewScreenState extends State<ComicReviewScreen> {
  final _styleController = TextEditingController(
    text: 'Kịch tính, cuốn hút, kể chuyện tự nhiên',
  );
  final List<XFile> _files = [];
  Uint8List? _localPreviewBytes;
  List<Map<String, dynamic>> _scenes = [];
  bool _analyzing = false;
  bool _rendering = false;
  int _progress = 0;
  String _status = '';
  String? _exportId;
  String? _videoUrl;

  @override
  void initState() {
    super.initState();
    _restoreDraft();
  }

  @override
  void dispose() {
    _styleController.dispose();
    super.dispose();
  }

  Future<void> _restoreDraft() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('resub_comic_review_draft');
    if (raw == null || !mounted) return;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      setState(() {
        _styleController.text =
            decoded['style']?.toString() ?? _styleController.text;
        _scenes = (decoded['scenes'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (_) {}
  }

  Future<void> _saveDraft() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'resub_comic_review_draft',
      jsonEncode({'style': _styleController.text, 'scenes': _scenes}),
    );
  }

  Future<void> _pickPages() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'zip'],
        allowMultiple: true,
        withData: kIsWeb,
      );
      if (result == null || result.files.isEmpty) return;

      final selected = <XFile>[];
      Uint8List? previewBytes;
      for (final file in result.files) {
        late final XFile selectedFile;
        if (kIsWeb) {
          final bytes = file.bytes;
          if (bytes == null || bytes.isEmpty) {
            throw Exception(
              'Trình duyệt không đọc được ${file.name}. Vui lòng chọn lại.',
            );
          }
          selectedFile = XFile.fromData(
            bytes,
            name: file.name,
            length: file.size,
          );
        } else {
          if (file.path == null || file.path!.isEmpty) {
            throw Exception('Không đọc được đường dẫn của ${file.name}.');
          }
          selectedFile = XFile(file.path!, name: file.name, length: file.size);
        }
        selected.add(selectedFile);
        final extension = file.extension?.toLowerCase();
        if (previewBytes == null && extension != 'zip') {
          previewBytes = file.bytes ?? await selectedFile.readAsBytes();
        }
      }

      if (!mounted) return;
      setState(() {
        _files
          ..clear()
          ..addAll(selected);
        _localPreviewBytes = previewBytes;
        _scenes = [];
        _videoUrl = null;
        _progress = 0;
        _status = 'Đã nhận ${_files.length} tệp. Nhấn nút AI để phân tích.';
      });
    } catch (error) {
      if (mounted) _showError(error);
    }
  }

  Future<void> _analyze() async {
    if (_files.isEmpty) return;
    setState(() {
      _analyzing = true;
      _progress = 0;
      _status = 'Đang tải trang truyện lên...';
    });
    try {
      final repo = context.read<VideoRepository>();
      final scenes = await repo.analyzeComicPages(
        _files,
        style: _styleController.text.trim(),
        onSendProgress: (sent, total) {
          if (mounted && total > 0) {
            setState(() {
              _progress = (sent / total * 35).round();
              _status = sent < total
                  ? 'Đang tải ảnh: ${(_progress / 0.35).round()}%'
                  : 'AI đang đọc và viết lời review...';
            });
          }
        },
      );
      if (!mounted) return;
      setState(() {
        _scenes = scenes;
        _progress = 100;
        _status = 'Đã tạo ${scenes.length} cảnh. Bạn có thể sửa lời review.';
      });
      await _saveDraft();
    } catch (e) {
      if (mounted) _showError(e);
    } finally {
      if (mounted) setState(() => _analyzing = false);
    }
  }

  Future<void> _render() async {
    if (_scenes.isEmpty ||
        _scenes.any((s) => (s['script']?.toString().trim() ?? '').isEmpty)) {
      _showError('Mỗi cảnh phải có lời review.');
      return;
    }
    setState(() {
      _rendering = true;
      _progress = 1;
      _videoUrl = null;
      _status = 'Đang gửi tác vụ dựng video...';
    });
    final repo = context.read<VideoRepository>();
    try {
      await _saveDraft();
      _exportId = await repo.startComicReviewRender(_scenes);
      while (mounted && _rendering && _exportId != null) {
        await Future<void>.delayed(const Duration(seconds: 2));
        final result = await repo.getComicReviewStatus(_exportId!);
        if (!mounted) return;
        final status = result['status']?.toString() ?? '';
        setState(() {
          _progress = (result['percent'] as num?)?.round() ?? _progress;
          _status =
              result['message']?.toString() ??
              result['error']?.toString() ??
              _status;
        });
        if (status == 'completed') {
          setState(() {
            _rendering = false;
            _videoUrl = result['videoUrl']?.toString();
          });
          break;
        }
        if (status == 'error' || status == 'cancelled') {
          throw Exception(
            result['error'] ?? result['message'] ?? 'Xuất video thất bại.',
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _rendering = false);
        _showError(e);
      }
    }
  }

  Future<void> _cancel() async {
    final id = _exportId;
    setState(() {
      _rendering = false;
      _status = 'Đang hủy...';
    });
    if (id != null) {
      await context.read<VideoRepository>().cancelComicReview(id);
    }
    if (mounted) {
      setState(() {
        _progress = 0;
        _status = 'Đã hủy xuất video.';
      });
    }
  }

  void _showError(Object error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(error.toString().replaceFirst('Exception: ', '')),
        backgroundColor: AppColors.error,
      ),
    );
  }

  void _move(int index, int offset) {
    final target = index + offset;
    if (target < 0 || target >= _scenes.length) return;
    setState(() {
      final item = _scenes.removeAt(index);
      _scenes.insert(target, item);
    });
    _saveDraft();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              Navigator.pushReplacementNamed(context, '/dashboard'),
        ),
        title: const Text('Review truyện tranh — Video YouTube 16:9'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 20),
            child: Center(
              child: Text(
                '1920 × 1080',
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final editor = _buildEditor();
          final preview = _buildPreview();
          return constraints.maxWidth >= 1050
              ? Row(
                  children: [
                    SizedBox(width: 470, child: editor),
                    const VerticalDivider(width: 1),
                    Expanded(child: preview),
                  ],
                )
              : ListView(
                  children: [
                    editor,
                    const Divider(height: 1),
                    SizedBox(height: 650, child: preview),
                  ],
                );
        },
      ),
    );
  }

  Widget _buildEditor() {
    return Container(
      color: const Color(0xFF101827),
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            '1. Thêm trang truyện',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Hỗ trợ JPG, PNG, WebP và ZIP. Thứ tự file là thứ tự kể chuyện.',
            style: TextStyle(color: AppColors.textMuted),
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: (_analyzing || _rendering) ? null : _pickPages,
            icon: const Icon(Icons.collections),
            label: Text(
              _files.isEmpty
                  ? 'Chọn ảnh hoặc ZIP'
                  : 'Đã chọn ${_files.length} tệp — chọn lại',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _styleController,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Phong cách lời review',
              hintText: 'Ví dụ: hài hước, kịch tính...',
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: (_files.isEmpty || _analyzing || _rendering)
                ? null
                : _analyze,
            icon: _analyzing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.auto_awesome),
            label: const Text('AI ĐỌC ẢNH VÀ VIẾT LỜI REVIEW'),
          ),
          if (_status.isNotEmpty) ...[
            const SizedBox(height: 14),
            LinearProgressIndicator(
              value: _progress > 0 ? _progress / 100 : null,
            ),
            const SizedBox(height: 7),
            Text(
              _status,
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
          if (_scenes.isNotEmpty) ...[
            const SizedBox(height: 22),
            Text(
              '2. Chỉnh lời review (${_scenes.length} cảnh)',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            ...List.generate(
              _scenes.length,
              (index) => _buildSceneEditor(index),
            ),
            const SizedBox(height: 12),
            if (!_rendering)
              ElevatedButton.icon(
                onPressed: _render,
                icon: const Icon(Icons.movie_creation),
                label: const Text('XUẤT VIDEO REVIEW 16:9'),
              ),
            if (_rendering)
              OutlinedButton.icon(
                onPressed: _cancel,
                icon: const Icon(Icons.stop_circle),
                label: const Text('HỦY XUẤT VIDEO'),
              ),
            if (_videoUrl != null)
              ElevatedButton.icon(
                onPressed: () => launchUrl(
                  Uri.parse(_videoUrl!),
                  mode: LaunchMode.externalApplication,
                ),
                icon: const Icon(Icons.download),
                label: const Text('TẢI VIDEO MP4'),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildSceneEditor(int index) {
    final scene = _scenes[index];
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 15,
                  child: Text(
                    '${index + 1}',
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: index > 0 ? () => _move(index, -1) : null,
                  icon: const Icon(Icons.arrow_upward, size: 18),
                ),
                IconButton(
                  onPressed: index + 1 < _scenes.length
                      ? () => _move(index, 1)
                      : null,
                  icon: const Icon(Icons.arrow_downward, size: 18),
                ),
                IconButton(
                  onPressed: () {
                    setState(() => _scenes.removeAt(index));
                    _saveDraft();
                  },
                  icon: const Icon(
                    Icons.delete_outline,
                    color: AppColors.error,
                    size: 18,
                  ),
                ),
              ],
            ),
            TextFormField(
              key: ValueKey('${scene['fileId']}-$index'),
              initialValue: scene['script']?.toString(),
              minLines: 2,
              maxLines: 5,
              onChanged: (value) {
                scene['script'] = value;
                _saveDraft();
              },
              decoration: const InputDecoration(labelText: 'Lời review'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreview() {
    return Container(
      padding: const EdgeInsets.all(28),
      color: const Color(0xFF080D18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Xem trước khung YouTube 16:9',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              clipBehavior: Clip.antiAlias,
              child: _scenes.isEmpty && _localPreviewBytes == null
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.photo_library_outlined,
                            size: 70,
                            color: AppColors.textMuted,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'Ảnh truyện sẽ hiển thị tại đây',
                            style: TextStyle(color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    )
                  : _scenes.isEmpty
                  ? Image.memory(_localPreviewBytes!, fit: BoxFit.contain)
                  : Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.network(
                          _scenes.first['imageUrl'].toString(),
                          fit: BoxFit.contain,
                        ),
                        Align(
                          alignment: Alignment.bottomCenter,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 35,
                              vertical: 22,
                            ),
                            color: Colors.black54,
                            child: Text(
                              _scenes.first['script']?.toString() ?? '',
                              textAlign: TextAlign.center,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                shadows: [
                                  Shadow(blurRadius: 4, color: Colors.black),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 18),
          const Row(
            children: [
              Icon(Icons.record_voice_over, color: AppColors.primary),
              SizedBox(width: 8),
              Text(
                'Giọng mặc định: Cô Gái Hoạt Ngôn (CapCut)',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Khi xuất, mỗi trang được tự căn theo độ dài lời đọc, thêm chuyển động zoom nhẹ và phụ đề.',
            style: TextStyle(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
