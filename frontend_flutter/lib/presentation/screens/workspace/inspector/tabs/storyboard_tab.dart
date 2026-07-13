import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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

  @override
  void dispose() {
    _contextController.dispose();
    _rulesController.dispose();
    _toneController.dispose();
    super.dispose();
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
      
      // Convert subtitles to backend payload format
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
          voice: oldSub.voice, // maintain customized voice voice configuration
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
        // Sync local inputs if not initialized yet
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
              // Section 1: Introduction
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

              // Context Input
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

              // Character rules Input
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

              // Translation Tone Input
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

              // Status indicator
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

              // Action buttons
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
            ],
          ),
        );
      },
    );
  }
}
