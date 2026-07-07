import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/colors.dart';
import '../../../../bloc/workspace/workspace_bloc.dart';
import '../../../../bloc/workspace/workspace_event.dart';
import '../../../../bloc/workspace/workspace_state.dart';

class AudioTab extends StatefulWidget {
  const AudioTab({super.key});

  @override
  State<AudioTab> createState() => _AudioTabState();
}

class _AudioTabState extends State<AudioTab> {
  final TextEditingController _cookieController = TextEditingController();

  // List of standard voices
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
  void initState() {
    super.initState();
    // Pre-populate cookie controller
    final state = context.read<WorkspaceBloc>().state;
    _cookieController.text = state.capcutCookie;
  }

  @override
  void dispose() {
    _cookieController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Section 1: Volumes
              const Text(
                'CẤU HÌNH ÂM LƯỢNG',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),
              
              // Background music volume
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Âm lượng Nhạc nền gốc'),
                  Text(
                    '${(state.bgVolume * 100).toInt()}%',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Slider(
                min: 0.0,
                max: 1.0,
                value: state.bgVolume.clamp(0.0, 1.0),
                onChanged: (val) {
                  context.read<WorkspaceBloc>().add(UpdateSettingsEvent(bgVolume: val));
                },
              ),
              const SizedBox(height: 12),

              // TTS voice volume
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Âm lượng Giọng thuyết minh AI'),
                  Text(
                    '${(state.ttsVolume * 100).toInt()}%',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Slider(
                min: 0.0,
                max: 1.5,
                value: state.ttsVolume.clamp(0.0, 1.5),
                onChanged: (val) {
                  context.read<WorkspaceBloc>().add(UpdateSettingsEvent(ttsVolume: val));
                },
              ),

              const SizedBox(height: 24),
              const Divider(color: AppColors.border),
              const SizedBox(height: 12),

              // Section 2: Voice selections
              const Text(
                'LỰA CHỌN GIỌNG ĐỌC AI',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                initialValue: state.defaultVoice,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Giọng đọc mặc định',
                ),
                dropdownColor: AppColors.surface,
                items: _voices.map((voice) {
                  return DropdownMenuItem<String>(
                    value: voice['value'],
                    child: Text(
                      voice['label']!,
                      style: const TextStyle(color: Colors.white),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    context.read<WorkspaceBloc>().add(UpdateSettingsEvent(defaultVoice: val));
                  }
                },
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                icon: const Icon(Icons.playlist_add_check, size: 16),
                label: const Text('Áp dụng giọng này cho tất cả câu thoại'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white10,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: () {
                  context.read<WorkspaceBloc>().add(BulkVoiceChangeEvent(state.defaultVoice));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã cập nhật giọng đọc cho toàn bộ câu thoại!'),
                      backgroundColor: AppColors.primary,
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),

              // CapCut Cookie text field
              if (state.defaultVoice.startsWith('vi-VN-') && !state.defaultVoice.contains('Neural')) ...[
                // Wait, if it contains capcut voices (e.g. vi-VN-female-reading)
                // actually we check if the selected voice is a CapCut voice (contains 'reading' or starts with 'capcut')
              ],
              // Let's show it by default or dynamically when CapCut voice is selected
              const Text(
                'CẤU HÌNH CAPCUT (NẾU DÙNG GIỌNG ĐỌC CAPCUT)',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _cookieController,
                decoration: const InputDecoration(
                  labelText: 'CapCut Cookie (Session)',
                  hintText: 'gkey=... or sign=...',
                ),
                maxLines: 3,
                onChanged: (val) {
                  context.read<WorkspaceBloc>().add(UpdateSettingsEvent(capcutCookie: val));
                },
              ),
              const SizedBox(height: 8),
              const Text(
                '💡 Đã cấu hình cookie mặc định sẵn trên hệ thống. Bạn không cần phải nhập trừ khi muốn sử dụng tài khoản CapCut riêng khác.',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontStyle: FontStyle.italic),
              ),
            ],
          ),
        );
      },
    );
  }
}
