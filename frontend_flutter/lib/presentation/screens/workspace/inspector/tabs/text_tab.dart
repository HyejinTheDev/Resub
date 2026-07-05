import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/colors.dart';
import '../../../../bloc/workspace/workspace_bloc.dart';
import '../../../../bloc/workspace/workspace_event.dart';
import '../../../../bloc/workspace/workspace_state.dart';

class TextTab extends StatelessWidget {
  const TextTab({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        final int index = state.selectedSubtitleIndex;
        final bool isSelected = index >= 0 && index < state.subtitles.length;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Section 1: Subtitle Text Editing
              const Text(
                'NỘI DUNG PHÂN ĐOẠN',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              if (!isSelected) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text(
                    'Hãy chọn một phân đoạn phụ đề dưới timeline để biên dịch và lồng tiếng.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ),
              ] else ...[
                // Original text field
                TextField(
                  controller: TextEditingController(text: state.subtitles[index].chineseText)
                    ..selection = TextSelection.collapsed(offset: state.subtitles[index].chineseText.length),
                  decoration: const InputDecoration(
                    labelText: 'Chữ Tiếng Trung gốc',
                  ),
                  maxLines: 2,
                  onChanged: (val) {
                    context.read<WorkspaceBloc>().add(
                      UpdateSubtitleTextEvent(
                        index: index,
                        text: state.subtitles[index].text,
                        chineseText: val,
                        voice: state.subtitles[index].voice,
                      ),
                    );
                  },
                ),
                const SizedBox(height: 12),
                
                // Translated text field
                TextField(
                  controller: TextEditingController(text: state.subtitles[index].text)
                    ..selection = TextSelection.collapsed(offset: state.subtitles[index].text.length),
                  decoration: const InputDecoration(
                    labelText: 'Dịch nghĩa Tiếng Việt',
                  ),
                  maxLines: 2,
                  onChanged: (val) {
                    context.read<WorkspaceBloc>().add(
                      UpdateSubtitleTextEvent(
                        index: index,
                        text: val,
                        chineseText: state.subtitles[index].chineseText,
                        voice: state.subtitles[index].voice,
                      ),
                    );
                  },
                ),
              ],
              
              const SizedBox(height: 24),
              const Divider(color: AppColors.border),
              const SizedBox(height: 12),

              // Section 2: Global Styling (Applies to all subs)
              const Text(
                'KIỂU CHỮ HỆ THỐNG',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),

              // Font Size Slider
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Cỡ chữ'),
                  Text(
                    '${state.subtitleFontSize.toInt()}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Slider(
                min: 8.0,
                max: 32.0,
                value: state.subtitleFontSize.clamp(8.0, 32.0),
                onChanged: (val) {
                  context.read<WorkspaceBloc>().add(UpdateSubtitleStyleEvent(fontSize: val));
                },
              ),
              const SizedBox(height: 12),

              // Position Slider
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Vị trí chiều dọc (Y%)'),
                  Text(
                    '${state.subtitleYPercent.toInt()}%',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Slider(
                min: 10.0,
                max: 95.0,
                value: state.subtitleYPercent.clamp(10.0, 95.0),
                onChanged: (val) {
                  context.read<WorkspaceBloc>().add(UpdateSubtitleStyleEvent(yPercent: val));
                },
              ),
              const SizedBox(height: 16),

              // Subtitle Color presets
              const Text('Màu chữ', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildColorPreset(context, state, '#FFFFFF', 'Trắng'),
                  const SizedBox(width: 8),
                  _buildColorPreset(context, state, '#EAB308', 'Vàng'),
                  const SizedBox(width: 8),
                  _buildColorPreset(context, state, '#3B82F6', 'Xanh lam'),
                  const SizedBox(width: 8),
                  _buildColorPreset(context, state, '#22C55E', 'Xanh lá'),
                ],
              ),
              const SizedBox(height: 16),

              // Outline Color presets
              const Text('Màu viền chữ', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildOutlinePreset(context, state, '#000000', 'Đen'),
                  const SizedBox(width: 8),
                  _buildOutlinePreset(context, state, '#EF4444', 'Đỏ'),
                  const SizedBox(width: 8),
                  _buildOutlinePreset(context, state, '#FFFFFF', 'Trắng'),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildColorPreset(
    BuildContext context,
    WorkspaceState state,
    String hexColor,
    String label,
  ) {
    final bool isSelected = state.subtitleColor.toLowerCase() == hexColor.toLowerCase();
    final Color color = Color(int.parse('FF${hexColor.replaceAll('#', '')}', radix: 16));

    return InkWell(
      onTap: () {
        context.read<WorkspaceBloc>().add(UpdateSubtitleStyleEvent(color: hexColor));
      },
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isSelected ? color : AppColors.border,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  Widget _buildOutlinePreset(
    BuildContext context,
    WorkspaceState state,
    String hexColor,
    String label,
  ) {
    final bool isSelected = state.subtitleOutlineColor.toLowerCase() == hexColor.toLowerCase();
    final Color color = Color(int.parse('FF${hexColor.replaceAll('#', '')}', radix: 16));

    return InkWell(
      onTap: () {
        context.read<WorkspaceBloc>().add(UpdateSubtitleStyleEvent(outlineColor: hexColor));
      },
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 0.5),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: Colors.white,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
