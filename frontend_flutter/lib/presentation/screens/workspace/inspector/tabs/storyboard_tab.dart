import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../../core/constants/colors.dart';
import '../../../../../domain/repositories/video_repository.dart';
import '../../../../../domain/entities/subtitle.dart';
import '../../../../bloc/workspace/workspace_bloc.dart';
import '../../../../bloc/workspace/workspace_event.dart';
import '../../../../bloc/workspace/workspace_state.dart';

class StoryboardTab extends StatefulWidget {
  const StoryboardTab({super.key});

  @override
  State<StoryboardTab> createState() => _StoryboardTabState();
}

class _StoryboardTabState extends State<StoryboardTab> {
  final TextEditingController _contextController = TextEditingController();
  final TextEditingController _rulesController = TextEditingController();
  final TextEditingController _toneController = TextEditingController();
  
  bool _isAnalyzing = false;
  bool _isTranslating = false;
  String _statusMessage = '';
  List<dynamic> _presets = [];

  @override
  void initState() {
    super.initState();
    _loadPresets();
  }

  @override
  void dispose() {
    _contextController.dispose();
    _rulesController.dispose();
    _toneController.dispose();
    super.dispose();
  }

  Future<void> _loadPresets() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final String? jsonStr = prefs.getString('resub_global_storyboard_presets');
      if (jsonStr != null) {
        setState(() {
          _presets = jsonDecode(jsonStr) as List<dynamic>;
        });
      }
    } catch (e) {
      debugPrint('Failed to load presets: $e');
    }
  }

  Future<void> _savePreset(String name, String contextText, String rulesText, String toneText) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final List<dynamic> updated = List<dynamic>.from(_presets);
      
      updated.insert(0, {
        'id': DateTime.now().millisecondsSinceEpoch.toString(),
        'name': name,
        'context': contextText,
        'characterRules': rulesText,
        'translationTone': toneText,
      });

      await prefs.setString('resub_global_storyboard_presets', jsonEncode(updated));
      setState(() {
        _presets = updated;
      });
    } catch (e) {
      debugPrint('Failed to save preset: $e');
    }
  }

  Future<void> _deletePreset(String id) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final List<dynamic> updated = List<dynamic>.from(_presets);
      updated.removeWhere((item) => item['id'] == id);

      await prefs.setString('resub_global_storyboard_presets', jsonEncode(updated));
      setState(() {
        _presets = updated;
      });
    } catch (e) {
      debugPrint('Failed to delete preset: $e');
    }
  }

  void _applyPreset(BuildContext context, WorkspaceState state, Map<String, dynamic> preset) {
    final String c = preset['context']?.toString() ?? '';
    final String cr = preset['characterRules']?.toString() ?? '';
    final String tt = preset['translationTone']?.toString() ?? '';

    _contextController.text = c;
    _rulesController.text = cr;
    _toneController.text = tt;

    _updateStoryboard(context, state, c: c, cr: cr, tt: tt);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã áp dụng kịch bản mẫu "${preset['name']}"!'),
        backgroundColor: AppColors.primary,
      ),
    );
  }

  Future<void> _showSavePresetDialog(BuildContext context, WorkspaceState state) async {
    final String contextText = _contextController.text.trim();
    final String rulesText = _rulesController.text.trim();
    final String toneText = _toneController.text.trim();

    if (contextText.isEmpty && rulesText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng điền nội dung kịch bản trước khi lưu!')),
      );
      return;
    }

    final TextEditingController nameController = TextEditingController(
      text: 'Mẫu kịch bản ${DateTime.now().day}/${DateTime.now().month}'
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E202C),
        title: const Text('Lưu kịch bản mẫu', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: nameController,
          decoration: const InputDecoration(
            labelText: 'Tên kịch bản mẫu',
            labelStyle: TextStyle(color: Colors.white70),
          ),
          style: const TextStyle(color: Colors.white),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('HỦY', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              final String name = nameController.text.trim();
              if (name.isNotEmpty) {
                _savePreset(name, contextText, rulesText, toneText);
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Đã lưu mẫu kịch bản vào lịch sử!'),
                    backgroundColor: AppColors.primary,
                  ),
                );
              }
            },
            child: const Text('LƯU', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _updateStoryboard(BuildContext context, WorkspaceState state, {String? c, String? cr, String? tt}) {
    final updated = Map<String, dynamic>.from(state.storyboard);
    if (c != null) updated['context'] = c;
    if (cr != null) updated['characterRules'] = cr;
    if (tt != null) updated['translationTone'] = tt;
    context.read<WorkspaceBloc>().add(UpdateStoryboardEvent(updated));
  }

  Future<void> _runAiSuggest(BuildContext context, WorkspaceState state) async {
    if (state.subtitles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng tạo hoặc tải phụ đề trước khi phân tích!')),
      );
      return;
    }

    setState(() {
      _isAnalyzing = true;
      _statusMessage = 'AI đang phân tích phụ đề để nhận diện xưng hô...';
    });

    try {
      final videoRepository = RepositoryProvider.of<VideoRepository>(context);
      
      final List<Map<String, dynamic>> subsJson = state.subtitles.map((s) => {
        'startTime': s.startTime,
        'endTime': s.endTime,
        'chineseText': s.chineseText,
        'text': s.text
      }).toList();

      final suggestion = await videoRepository.suggestStoryboard(
        subtitles: subsJson,
        geminiKey: state.videoData['geminiKey'],
      );

      final String suggestedContext = suggestion['context']?.toString() ?? '';
      final String suggestedRules = suggestion['characterRules']?.toString() ?? '';
      final String suggestedTone = suggestion['translationTone']?.toString() ?? '';

      if (!context.mounted) return;
      _contextController.text = suggestedContext;
      _rulesController.text = suggestedRules;
      _toneController.text = suggestedTone;

      _updateStoryboard(
        context,
        state,
        c: suggestedContext,
        cr: suggestedRules,
        tt: suggestedTone,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('AI đã phân tích và gợi ý kịch bản thành công!'),
          backgroundColor: AppColors.primary,
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi gợi ý kịch bản: ${e.toString()}')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isAnalyzing = false;
          _statusMessage = '';
        });
      }
    }
  }

  Future<void> _runReTranslate(BuildContext context, WorkspaceState state) async {
    if (state.subtitles.isEmpty) return;

    final String contextText = _contextController.text.trim();
    final String rulesText = _rulesController.text.trim();
    final String toneText = _toneController.text.trim();

    if (contextText.isEmpty && rulesText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng điền Bối cảnh hoặc Quy tắc xưng hô trước khi dịch!')),
      );
      return;
    }

    setState(() {
      _isTranslating = true;
      _statusMessage = 'Đang dịch lại phụ đề theo kịch bản...';
    });

    try {
      final videoRepository = RepositoryProvider.of<VideoRepository>(context);

      final List<Map<String, dynamic>> subsJson = state.subtitles.map((s) => {
        'startTime': s.startTime,
        'endTime': s.endTime,
        'chineseText': s.chineseText,
        'text': s.text
      }).toList();

      final Map<String, dynamic> storyboardJson = {
        'context': contextText,
        'characterRules': rulesText,
        'translationTone': toneText,
      };

      final result = await videoRepository.translateWithStoryboard(
        subtitles: subsJson,
        storyboard: storyboardJson,
        geminiKey: state.videoData['geminiKey'],
      );

      final List<dynamic> newSubsList = result['subtitles'] as List<dynamic>;
      final List<Subtitle> updatedSubtitles = [];

      for (int i = 0; i < newSubsList.length; i++) {
        final item = newSubsList[i];
        final oldSub = state.subtitles[i];
        
        updatedSubtitles.add(Subtitle(
          startTime: item['startTime']?.toString() ?? oldSub.startTime,
          endTime: item['endTime']?.toString() ?? oldSub.endTime,
          chineseText: item['chineseText']?.toString() ?? oldSub.chineseText,
          text: item['text']?.toString() ?? oldSub.text,
          voice: oldSub.voice,
        ));
      }

      if (!context.mounted) return;
      context.read<WorkspaceBloc>().add(UpdateSubtitlesEvent(updatedSubtitles));
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã đồng bộ dịch thuật lại phụ đề theo kịch bản!'),
          backgroundColor: AppColors.primary,
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi dịch lại: ${e.toString()}')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isTranslating = false;
          _statusMessage = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        if (_contextController.text.isEmpty && state.storyboard['context'] != null) {
          _contextController.text = state.storyboard['context'].toString();
        }
        if (_rulesController.text.isEmpty && state.storyboard['characterRules'] != null) {
          _rulesController.text = state.storyboard['characterRules'].toString();
        }
        if (_toneController.text.isEmpty && state.storyboard['translationTone'] != null) {
          _toneController.text = state.storyboard['translationTone'].toString();
        }

        final bool isLoading = _isAnalyzing || _isTranslating;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'KỊCH BẢN & XƯNG HÔ',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 8),
              Text(
                'Thiết lập bối cảnh và quy tắc xưng hô giữa các nhân vật để AI dịch phụ đề Tiếng Việt thống nhất, tránh bị loạn chủ ngữ/vị ngữ.',
                style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6), height: 1.4),
              ),
              const SizedBox(height: 20),

              TextField(
                controller: _contextController,
                decoration: const InputDecoration(
                  labelText: 'Tóm tắt bối cảnh video (Bắt buộc)',
                  hintText: 'Ví dụ: Bài giảng môn Toán giữa thầy giáo trung niên và học sinh cấp 3...',
                ),
                maxLines: 2,
                style: const TextStyle(fontSize: 13, color: Colors.white),
                enabled: !isLoading,
                onChanged: (val) => _updateStoryboard(context, state, c: val),
              ),
              const SizedBox(height: 16),

              TextField(
                controller: _rulesController,
                decoration: const InputDecoration(
                  labelText: 'Quy tắc xưng hô nhân vật (Bắt buộc)',
                  hintText: 'Ví dụ: Thầy giáo: xưng "Thầy", gọi "Em". Học sinh: xưng "Em", gọi "Thầy".',
                ),
                maxLines: 3,
                style: const TextStyle(fontSize: 13, color: Colors.white),
                enabled: !isLoading,
                onChanged: (val) => _updateStoryboard(context, state, cr: val),
              ),
              const SizedBox(height: 16),

              TextField(
                controller: _toneController,
                decoration: const InputDecoration(
                  labelText: 'Giọng điệu dịch thuật (Tùy chọn)',
                  hintText: 'Ví dụ: Trang trọng, tự nhiên, phim cổ trang...',
                ),
                maxLines: 1,
                style: const TextStyle(fontSize: 13, color: Colors.white),
                enabled: !isLoading,
                onChanged: (val) => _updateStoryboard(context, state, tt: val),
              ),
              const SizedBox(height: 24),
              const Divider(color: AppColors.border),
              const SizedBox(height: 16),

              if (isLoading) ...[
                Column(
                  children: [
                    const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.primary),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _statusMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ],

              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.auto_awesome, size: 16),
                      label: const Text('AI Gợi ý'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.primary),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: isLoading ? null : () => _runAiSuggest(context, state),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.translate_rounded, size: 16),
                      label: const Text('Dịch lại'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: isLoading ? null : () => _runReTranslate(context, state),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 28),
              const Divider(color: AppColors.border),
              const SizedBox(height: 16),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'LỊCH SỬ KỊCH BẢN MẪU',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                  ),
                  TextButton.icon(
                    icon: const Icon(Icons.bookmark_add_outlined, size: 14, color: AppColors.primary),
                    label: const Text('Lưu mẫu mới', style: TextStyle(fontSize: 11, color: AppColors.primary)),
                    onPressed: isLoading ? null : () => _showSavePresetDialog(context, state),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (_presets.isEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.02),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    'Chưa có mẫu kịch bản nào được lưu.\nBạn có thể lưu kịch bản hiện tại để dùng lại sau này.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.4), height: 1.4),
                  ),
                ),
              ] else ...[
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _presets.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final preset = _presets[index] as Map<String, dynamic>;
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.03),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  preset['name']?.toString() ?? 'Không tên',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  preset['context']?.toString() ?? '',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.5)),
                                ),
                              ],
                            ),
                          ),
                          // Apply Button
                          IconButton(
                            icon: const Icon(Icons.download_rounded, color: AppColors.primary, size: 18),
                            tooltip: 'Áp dụng',
                            onPressed: isLoading ? null : () => _applyPreset(context, state, preset),
                          ),
                          // Delete Button
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 18),
                            tooltip: 'Xóa',
                            onPressed: isLoading ? null : () {
                              showDialog(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  backgroundColor: const Color(0xFF1E202C),
                                  title: const Text('Xóa kịch bản mẫu?', style: TextStyle(color: Colors.white)),
                                  content: Text(
                                    'Bạn có chắc chắn muốn xóa mẫu kịch bản "${preset['name']}" khỏi lịch sử không?',
                                    style: const TextStyle(color: Colors.white70),
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('HỦY', style: TextStyle(color: Colors.grey)),
                                    ),
                                    TextButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        _deletePreset(preset['id']?.toString() ?? '');
                                      },
                                      child: const Text('XÓA', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
