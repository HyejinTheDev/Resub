import 'package:flutter/material.dart';

import '../../../../core/constants/colors.dart';
import 'tabs/text_tab.dart';
import 'tabs/audio_tab.dart';
import 'tabs/mask_tab.dart';
import 'tabs/export_tab.dart';
import 'tabs/storyboard_tab.dart';

class InspectorPanel extends StatelessWidget {
  const InspectorPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: const PreferredSize(
          preferredSize: Size.fromHeight(48),
          child: Material(
            color: AppColors.surface,
            child: TabBar(
              indicatorColor: AppColors.primary,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textMuted,
              tabs: [
                Tab(icon: Icon(Icons.text_fields, size: 20), text: 'Chữ'),
                Tab(icon: Icon(Icons.volume_up, size: 20), text: 'Âm'),
                Tab(icon: Icon(Icons.blur_on, size: 20), text: 'Mờ'),
                Tab(icon: Icon(Icons.movie_creation_outlined, size: 20), text: 'Kịch bản'),
                Tab(icon: Icon(Icons.download, size: 20), text: 'Xuất'),
              ],
            ),
          ),
        ),
        body: Container(
          decoration: const BoxDecoration(
            color: AppColors.background,
          ),
          child: const TabBarView(
            children: [
              TextTab(),
              AudioTab(),
              MaskTab(),
              StoryboardTab(),
              ExportTab(),
            ],
          ),
        ),
      ),
    );
  }
}
