import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/colors.dart';
import '../../../data/models/project_model.dart';
import '../../../domain/repositories/auth_repository.dart';
import '../../bloc/auth/auth_bloc.dart';
import '../../bloc/auth/auth_event.dart';
import '../../bloc/auth/auth_state.dart';
import '../../bloc/project/project_bloc.dart';
import '../../bloc/project/project_event.dart';
import '../../bloc/project/project_state.dart';
import '../../bloc/workspace/workspace_bloc.dart';
import '../../bloc/workspace/workspace_event.dart';
import '../import/import_screen.dart';

class ProjectDashboardScreen extends StatefulWidget {
  const ProjectDashboardScreen({super.key});

  @override
  State<ProjectDashboardScreen> createState() => _ProjectDashboardScreenState();
}

class _ProjectDashboardScreenState extends State<ProjectDashboardScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    context.read<ProjectBloc>().add(LoadAllProjectsEvent());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatTimeAgo(int timestamp) {
    final diff = DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(timestamp));
    if (diff.inSeconds < 60) return 'Vừa xong';
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút trước';
    if (diff.inHours < 24) return '${diff.inHours} giờ trước';
    return '${diff.inDays} ngày trước';
  }

  void _showRenameDialog(ProjectModel project) {
    final controller = TextEditingController(text: project.name);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Đổi tên dự án'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Nhập tên mới...'),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              final newName = controller.text.trim();
              if (newName.isNotEmpty) {
                context.read<ProjectBloc>().add(RenameProjectEvent(project.id, newName));
              }
              Navigator.pop(context);
            },
            child: const Text('Đồng ý', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    String username = 'Khách';
    String subscriptionTier = 'FREE';
    int used = 0;
    int quota = 10;
    String? userId;

    if (authState is Authenticated) {
      username = authState.user.username;
      subscriptionTier = authState.user.subscriptionTier.toUpperCase();
      used = authState.user.videoExportUsed;
      quota = authState.user.videoExportQuota;
      userId = authState.user.id;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('RESUB — Auto Dubbing Dashboard'),
        actions: [
          if (authState is Authenticated) ...[
            // Subscription Quota Display
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: subscriptionTier == 'PRO'
                      ? const Color(0xFF10B981).withValues(alpha: 0.15)
                      : Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: subscriptionTier == 'PRO'
                        ? const Color(0xFF10B981).withValues(alpha: 0.4)
                        : AppColors.border,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      subscriptionTier == 'PRO'
                          ? Icons.workspace_premium_rounded
                          : Icons.card_membership_outlined,
                      size: 14,
                      color: subscriptionTier == 'PRO'
                          ? const Color(0xFF34D399)
                          : Colors.white70,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Gói $subscriptionTier (${quota - used < 0 ? 0 : quota - used}/$quota lượt)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: subscriptionTier == 'PRO'
                            ? const Color(0xFF34D399)
                            : Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            
            // Upgrade Pro Button if Free
            if (subscriptionTier == 'FREE' && userId != null) ...[
              Center(
                child: TextButton.icon(
                  onPressed: () => _showUpgradeDialog(context, userId!),
                  icon: const Icon(Icons.bolt, size: 14, color: AppColors.primary),
                  label: const Text(
                    'Nâng cấp PRO',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],
          ],

          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.person, size: 14, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      username,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent, size: 18),
            tooltip: 'Đăng xuất',
            onPressed: () {
              context.read<AuthBloc>().add(LogoutRequestedEvent());
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Embedded Import Card & Long Video Splitter
            // Since ImportScreen is a Scaffold, we wrap it in a sized layout or directly render its core contents.
            // But to make it clean, we render the original ImportScreen content in a container:
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: const SizedBox(
                height: 520,
                child: ImportScreen(),
              ),
            ),

            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24.0),
              child: Divider(color: AppColors.border, height: 40),
            ),

            // Projects Area
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Dự án của tôi',
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Quản lý và tiếp tục biên tập các video lồng tiếng của bạn',
                            style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                          ),
                        ],
                      ),

                      // Search bar
                      SizedBox(
                        width: 260,
                        height: 38,
                        child: TextField(
                          controller: _searchController,
                          onChanged: (val) {
                            setState(() {
                              _searchQuery = val.trim().toLowerCase();
                            });
                          },
                          decoration: InputDecoration(
                            hintText: 'Tìm kiếm dự án...',
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
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Project List/Grid
                  BlocBuilder<ProjectBloc, ProjectState>(
                    builder: (context, state) {
                      if (state is ProjectLoading) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.symmetric(vertical: 40.0),
                            child: CircularProgressIndicator(color: AppColors.primary),
                          ),
                        );
                      }

                      List<ProjectModel> list = [];
                      if (state is ProjectsLoaded) {
                        list = state.projects;
                      }

                      if (_searchQuery.isNotEmpty) {
                        list = list.where((p) => p.name.toLowerCase().contains(_searchQuery)).toList();
                      }

                      if (list.isEmpty) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 60.0),
                            child: Column(
                              children: const [
                                Icon(Icons.movie_filter, size: 48, color: AppColors.textMuted),
                                SizedBox(height: 12),
                                Text(
                                  'Chưa có dự án nào',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          ),
                        );
                      }

                      return LayoutBuilder(
                        builder: (context, constraints) {
                          final crossCount = (constraints.maxWidth / 240).floor().clamp(1, 6);
                          return GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: list.length,
                            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: crossCount,
                              crossAxisSpacing: 20,
                              mainAxisSpacing: 20,
                              childAspectRatio: 1.15,
                            ),
                            itemBuilder: (context, idx) {
                              final proj = list[idx];
                              return _buildProjectCard(proj);
                            },
                          );
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 48),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProjectCard(ProjectModel project) {
    final fileName = project.videoData['videoName'] ?? project.videoData['videoPath']?.split('/').last ?? 'Không tên';

    return Card(
      color: const Color(0xFF171923),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          // Load project to workspace
          context.read<WorkspaceBloc>().add(LoadProjectWorkspaceEvent(project));
          Navigator.pushReplacementNamed(context, '/workspace');
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Thumbnail / Top card part
            Expanded(
              flex: 5,
              child: Container(
                color: Colors.black,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    const Center(
                      child: Icon(Icons.movie_creation, size: 28, color: AppColors.primary),
                    ),
                    // Action Buttons overlay
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit, size: 14, color: Colors.white70),
                            onPressed: () => _showRenameDialog(project),
                            constraints: const BoxConstraints(),
                            padding: const EdgeInsets.all(4),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete, size: 14, color: Colors.redAccent),
                            onPressed: () {
                              showDialog(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: const Text('Xóa dự án?'),
                                  content: Text('Bạn có chắc chắn muốn xóa dự án "${project.name}" không?'),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.pop(context),
                                      child: const Text('Hủy'),
                                    ),
                                    TextButton(
                                      onPressed: () {
                                        context.read<ProjectBloc>().add(DeleteProjectEvent(project.id));
                                        Navigator.pop(context);
                                      },
                                      child: const Text('Xóa', style: TextStyle(color: Colors.redAccent)),
                                    ),
                                  ],
                                ),
                              );
                            },
                            constraints: const BoxConstraints(),
                            padding: const EdgeInsets.all(4),
                          ),
                        ],
                      ),
                    ),
                    // Subtitle count badge
                    Positioned(
                      bottom: 4,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${project.subtitles.length} câu',
                          style: const TextStyle(fontSize: 10, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Details card part
            Expanded(
              flex: 4,
              child: Padding(
                padding: const EdgeInsets.all(10.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    Text(
                      project.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Tệp: $fileName',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _formatTimeAgo(project.updatedAt),
                          style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
                        ),
                        const Icon(Icons.arrow_forward_ios, size: 8, color: AppColors.primary),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showUpgradeDialog(BuildContext context, String userId) {
    final authRepository = RepositoryProvider.of<AuthRepository>(context);
    bool isGeneratingLink = false;
    Timer? checkPaymentTimer;
    Map<String, dynamic>? activePaymentData;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return BlocConsumer<AuthBloc, AuthState>(
              listener: (context, authState) {
                if (authState is Authenticated) {
                  if (authState.user.subscriptionTier == 'pro') {
                    // Success!
                    checkPaymentTimer?.cancel();
                    Navigator.of(dialogContext).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Nâng cấp lên gói PRO thành công!'),
                        backgroundColor: AppColors.primary,
                      ),
                    );
                  }
                }
              },
              builder: (context, authState) {
                return Dialog(
                  backgroundColor: Colors.transparent,
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 400),
                    decoration: BoxDecoration(
                      color: const Color(0xFF131520),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.08), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.5),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    padding: const EdgeInsets.all(28.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.workspace_premium_rounded,
                          color: AppColors.primary,
                          size: 64,
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Nâng Cấp Gói PRO',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        const SizedBox(height: 12),
                        if (checkPaymentTimer == null) ...[
                          Text(
                            'Nâng cấp lên gói PRO để nhận ngay 100 lượt xuất video chất lượng cao cùng các quyền lợi ưu tiên.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.7), height: 1.4),
                          ),
                          const SizedBox(height: 20),
                          _buildFeatureItem(Icons.movie_filter_outlined, '100 lượt xuất video chất lượng cao'),
                          const SizedBox(height: 10),
                          _buildFeatureItem(Icons.timer_outlined, 'Cho phép xuất video thời lượng dài hơn'),
                          const SizedBox(height: 10),
                          _buildFeatureItem(Icons.bolt_rounded, 'Ưu tiên kết xuất tốc độ tối đa'),
                          const SizedBox(height: 28),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => Navigator.of(dialogContext).pop(),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.white60,
                                    side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  child: const Text('Bỏ qua'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: isGeneratingLink
                                      ? null
                                      : () async {
                                          final authBloc = BlocProvider.of<AuthBloc>(context);
                                          final messenger = ScaffoldMessenger.of(context);
                                          setDialogState(() {
                                            isGeneratingLink = true;
                                          });
                                          try {
                                            final result = await authRepository.createPaymentLink(userId);
                                            final checkoutUrl = result['checkoutUrl']?.toString() ?? '';
                                            if (checkoutUrl.isNotEmpty) {
                                              await launchUrl(Uri.parse(checkoutUrl), mode: LaunchMode.externalApplication);
                                            }
                                            
                                            // Start polling for payment success
                                            setDialogState(() {
                                              activePaymentData = result;
                                              isGeneratingLink = false;
                                              checkPaymentTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
                                                if (mounted) {
                                                  authBloc.add(RefreshProfileEvent(userId: userId));
                                                }
                                              });
                                            });
                                          } catch (e) {
                                            setDialogState(() {
                                              isGeneratingLink = false;
                                            });
                                            messenger.showSnackBar(
                                              SnackBar(
                                                content: Text(e.toString().replaceAll('Exception: ', '')),
                                                backgroundColor: AppColors.error,
                                              ),
                                            );
                                          }
                                        },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  child: isGeneratingLink
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                                        )
                                      : const Text(
                                          'Thanh Toán QR',
                                          style: TextStyle(fontWeight: FontWeight.bold),
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ] else ...[
                          if (activePaymentData != null &&
                              activePaymentData!['bankId'] != null &&
                              activePaymentData!['accountNo'] != null &&
                              activePaymentData!['accountName'] != null) ...[
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Image.network(
                                'https://img.vietqr.io/image/${activePaymentData!['bankId']}-${activePaymentData!['accountNo']}-qr_only.png?amount=${activePaymentData!['amount']}&addInfo=RSB%20${activePaymentData!['orderCode']}&accountName=${Uri.encodeComponent(activePaymentData!['accountName'].toString())}',
                                width: 220,
                                height: 220,
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Đang Chờ Chuyển Khoản...',
                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Vui lòng quét mã QR ở trên để chuyển khoản 199.000đ.\n\nNội dung chuyển khoản: RSB ${activePaymentData!['orderCode']}',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.6), height: 1.4),
                            ),
                          ] else ...[
                            const SizedBox(height: 10),
                            const SizedBox(
                              width: 40,
                              height: 40,
                              child: CircularProgressIndicator(strokeWidth: 3.5, color: AppColors.primary),
                            ),
                            const SizedBox(height: 24),
                            const Text(
                              'Đang Chờ Chuyển Khoản...',
                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Vui lòng quét mã QR trên trang thanh toán vừa mở để chuyển khoản 199.000đ.\n\nHệ thống sẽ tự động kích hoạt tài khoản ngay sau khi nhận được tiền.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.6), height: 1.4),
                            ),
                          ],
                          const SizedBox(height: 28),
                          OutlinedButton(
                            onPressed: () {
                              checkPaymentTimer?.cancel();
                              Navigator.of(dialogContext).pop();
                            },
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white60,
                              side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              minimumSize: const Size(double.infinity, 44),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text('Hủy giao dịch'),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    ).then((_) {
      checkPaymentTimer?.cancel();
    });
  }

  Widget _buildFeatureItem(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primary, size: 18),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 12, color: Colors.white70),
          ),
        ),
      ],
    );
  }
}
