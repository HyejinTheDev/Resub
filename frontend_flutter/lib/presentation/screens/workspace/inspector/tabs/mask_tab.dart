import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/colors.dart';
import '../../../../bloc/workspace/workspace_bloc.dart';
import '../../../../bloc/workspace/workspace_event.dart';
import '../../../../bloc/workspace/workspace_state.dart';
import '../../../../../domain/entities/blur_mask.dart';

class MaskTab extends StatelessWidget {
  const MaskTab({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WorkspaceBloc, WorkspaceState>(
      builder: (context, state) {
        final int index = state.selectedMaskIndex;
        final bool isSelected = index >= 0 && index < state.blurMasks.length;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Section 1: Mask Manager List
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'DANH SÁCH VÙNG LÀM MỜ',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                  ),
                  TextButton.icon(
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Thêm mới', style: TextStyle(fontSize: 12)),
                    onPressed: () {
                      final newMask = BlurMask(
                        startTime: '00m00s000ms',
                        endTime: state.subtitles.isNotEmpty ? state.subtitles.last.endTime : '99m59s999ms',
                        yPercentage: 80.0,
                        heightPercentage: 15.0,
                        xPercentage: 50.0,
                        widthPercentage: 80.0,
                        blurRadius: 25.0, // Default to higher radius for stronger blur
                        color: '#000000', // Default to black tint cover
                        opacity: 0.4,     // Default to 40% opacity
                      );
                      context.read<WorkspaceBloc>().add(AddBlurMaskEvent(newMask));
                    },
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (state.blurMasks.isEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text(
                    'Chưa có vùng làm mờ nào được cấu hình.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ),
              ] else ...[
                // ListView of existing masks (chips/cards)
                SizedBox(
                  height: 42,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: state.blurMasks.length,
                    itemBuilder: (context, idx) {
                      final bool isMaskSelected = state.selectedMaskIndex == idx;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text('Vùng mờ #${idx + 1}'),
                          selected: isMaskSelected,
                          selectedColor: AppColors.primary.withValues(alpha: 0.3),
                          checkmarkColor: AppColors.primary,
                          onSelected: (selected) {
                            if (selected) {
                              context.read<WorkspaceBloc>().add(SelectBlurMaskEvent(idx));
                            }
                          },
                        ),
                      );
                    },
                  ),
                ),
              ],

              const SizedBox(height: 24),
              const Divider(color: AppColors.border),
              const SizedBox(height: 12),

              // Section 2: Editor for selected mask
              const Text(
                'ĐIỀU CHỈNH VÙNG MỜ ĐÃ CHỌN',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),

              if (!isSelected) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text(
                    'Hãy chọn hoặc tạo mới một vùng làm mờ phía trên để chỉnh sửa.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ),
              ] else ...[
                Builder(
                  builder: (context) {
                    final activeMask = state.blurMasks[index];
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Enabled Toggle
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Kích hoạt vùng mờ'),
                            Switch(
                              value: activeMask.enabled,
                              activeThumbColor: AppColors.primary,
                              onChanged: (val) {
                                context.read<WorkspaceBloc>().add(
                                      UpdateBlurMaskEvent(
                                        index: index,
                                        mask: activeMask.copyWith(enabled: val),
                                      ),
                                    );
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        const Text('Màu sắc vùng che', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            _buildColorButton(
                              context,
                              label: 'Trắng',
                              colorHex: '#FFFFFF',
                              activeColor: activeMask.color,
                              index: index,
                              mask: activeMask,
                            ),
                            const SizedBox(width: 8),
                            _buildColorButton(
                              context,
                              label: 'Đen',
                              colorHex: '#000000',
                              activeColor: activeMask.color,
                              index: index,
                              mask: activeMask,
                            ),
                            const SizedBox(width: 8),
                            _buildColorButton(
                              context,
                              label: 'Xám',
                              colorHex: '#808080',
                              activeColor: activeMask.color,
                              index: index,
                              mask: activeMask,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Width slider
                        _buildSliderRow(
                          label: 'Độ rộng (Width %)',
                          value: activeMask.widthPercentage,
                          min: 10.0,
                          max: 100.0,
                          onChanged: (val) {
                            context.read<WorkspaceBloc>().add(
                                  UpdateBlurMaskEvent(
                                    index: index,
                                    mask: activeMask.copyWith(widthPercentage: val),
                                  ),
                                );
                          },
                        ),

                        // Height slider
                        _buildSliderRow(
                          label: 'Độ cao (Height %)',
                          value: activeMask.heightPercentage,
                          min: 5.0,
                          max: 50.0,
                          onChanged: (val) {
                            context.read<WorkspaceBloc>().add(
                                  UpdateBlurMaskEvent(
                                    index: index,
                                    mask: activeMask.copyWith(heightPercentage: val),
                                  ),
                                );
                          },
                        ),

                        // X coordinate slider
                        _buildSliderRow(
                          label: 'Vị trí ngang (X %)',
                          value: activeMask.xPercentage,
                          min: 0.0,
                          max: 100.0,
                          onChanged: (val) {
                            context.read<WorkspaceBloc>().add(
                                  UpdateBlurMaskEvent(
                                    index: index,
                                    mask: activeMask.copyWith(xPercentage: val),
                                  ),
                                );
                          },
                        ),

                        // Y coordinate slider
                        _buildSliderRow(
                          label: 'Vị trí dọc (Y %)',
                          value: activeMask.yPercentage,
                          min: 0.0,
                          max: 100.0,
                          onChanged: (val) {
                            context.read<WorkspaceBloc>().add(
                                  UpdateBlurMaskEvent(
                                    index: index,
                                    mask: activeMask.copyWith(yPercentage: val),
                                  ),
                                );
                          },
                        ),

                        // Blur Intensity slider
                        _buildSliderRow(
                          label: 'Độ mờ (Blur Radius)',
                          value: activeMask.blurRadius,
                          min: 5.0,
                          max: 50.0,
                          onChanged: (val) {
                            context.read<WorkspaceBloc>().add(
                                  UpdateBlurMaskEvent(
                                    index: index,
                                    mask: activeMask.copyWith(blurRadius: val),
                                  ),
                                );
                          },
                        ),

                        // Opacity slider
                        _buildSliderRow(
                          label: 'Độ đậm nhạt (Opacity)',
                          value: activeMask.opacity,
                          min: 0.05,
                          max: 1.0,
                          onChanged: (val) {
                            context.read<WorkspaceBloc>().add(
                                  UpdateBlurMaskEvent(
                                    index: index,
                                    mask: activeMask.copyWith(opacity: val),
                                  ),
                                );
                          },
                        ),

                        const SizedBox(height: 20),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.delete, color: Colors.white, size: 20),
                          label: const Text('XÓA VÙNG LÀM MỜ', style: TextStyle(color: Colors.white)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error,
                          ),
                          onPressed: () {
                            context.read<WorkspaceBloc>().add(DeleteBlurMaskEvent(index));
                          },
                        ),
                      ],
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

  Widget _buildSliderRow({
    required String label,
    required double value,
    required double min,
    required double max,
    required ValueChanged<double> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 13)),
            Text(
              label.contains('Opacity') ? value.toStringAsFixed(2) : '${value.toInt()}%',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ],
        ),
        Slider(
          min: min,
          max: max,
          value: value.clamp(min, max),
          onChanged: onChanged,
        ),
        const SizedBox(height: 6),
      ],
    );
  }

  Widget _buildColorButton(
    BuildContext context, {
    required String label,
    required String colorHex,
    required String activeColor,
    required int index,
    required BlurMask mask,
  }) {
    final bool isSelected = activeColor.toLowerCase() == colorHex.toLowerCase();
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppColors.primary.withValues(alpha: 0.3),
      checkmarkColor: AppColors.primary,
      onSelected: (selected) {
        if (selected) {
          context.read<WorkspaceBloc>().add(
                UpdateBlurMaskEvent(
                  index: index,
                  mask: mask.copyWith(color: colorHex),
                ),
              );
        }
      },
    );
  }
}
