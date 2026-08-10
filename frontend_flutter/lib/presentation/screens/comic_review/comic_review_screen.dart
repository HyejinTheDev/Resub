import 'dart:convert';
import 'package:cross_file/cross_file.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  int _progress = 0;
  String _status = '';

  String get _combinedReview => _scenes
      .map((scene) => scene['script']?.toString().trim() ?? '')
      .where((text) => text.isNotEmpty)
      .join('\n\n');

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

  Future<void> _copyAllText() async {
    if (_combinedReview.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: _combinedReview));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã sao chép toàn bộ nội dung review.')),
      );
    }
  }

  Future<void> _downloadText() async {
    if (_combinedReview.isEmpty) return;
    await FilePicker.platform.saveFile(
      dialogTitle: 'Lưu nội dung review',
      fileName: 'review-truyen-tranh.txt',
      type: FileType.custom,
      allowedExtensions: const ['txt'],
      bytes: Uint8List.fromList(utf8.encode(_combinedReview)),
    );
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
        title: const Text('AI viết nội dung review truyện tranh'),
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
            onPressed: _analyzing ? null : _pickPages,
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
            onPressed: (_files.isEmpty || _analyzing) ? null : _analyze,
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
            'Nội dung review hoàn chỉnh',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          if (_localPreviewBytes != null || _scenes.isNotEmpty)
            Container(
              height: 190,
              decoration: BoxDecoration(
                color: Colors.black,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              clipBehavior: Clip.antiAlias,
              child: _scenes.isEmpty
                  ? Image.memory(_localPreviewBytes!, fit: BoxFit.contain)
                  : Image.network(
                      _scenes.first['imageUrl'].toString(),
                      fit: BoxFit.contain,
                    ),
            ),
          const SizedBox(height: 18),
          Row(
            children: [
              ElevatedButton.icon(
                onPressed: _combinedReview.isEmpty ? null : _copyAllText,
                icon: const Icon(Icons.copy),
                label: const Text('SAO CHÉP TOÀN BỘ'),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: _combinedReview.isEmpty ? null : _downloadText,
                icon: const Icon(Icons.download),
                label: const Text('TẢI FILE TXT'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Expanded(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF101827),
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: SelectionArea(
                child: SingleChildScrollView(
                  child: Text(
                    _combinedReview.isEmpty
                        ? 'Sau khi AI phân tích, toàn bộ bài review sẽ xuất hiện tại đây.'
                        : _combinedReview,
                    style: TextStyle(
                      fontSize: 16,
                      height: 1.65,
                      color: _combinedReview.isEmpty
                          ? AppColors.textMuted
                          : AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
