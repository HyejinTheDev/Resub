import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'core/constants/colors.dart';
import 'data/repositories/video_repository_impl.dart';
import 'data/repositories/auth_repository_impl.dart';
import 'data/repositories/project_repository_impl.dart';
import 'domain/repositories/video_repository.dart';
import 'domain/repositories/auth_repository.dart';
import 'domain/repositories/project_repository.dart';
import 'presentation/bloc/import/import_bloc.dart';
import 'presentation/bloc/workspace/workspace_bloc.dart';
import 'presentation/bloc/auth/auth_bloc.dart';
import 'presentation/bloc/auth/auth_event.dart';
import 'presentation/bloc/auth/auth_state.dart';
import 'presentation/bloc/project/project_bloc.dart';
import 'presentation/screens/auth/auth_screen.dart';
import 'presentation/screens/dashboard/project_dashboard_screen.dart';
import 'presentation/screens/workspace/workspace_screen.dart';
import 'presentation/screens/workspace/player/platform_view_helper.dart';
import 'presentation/screens/landing/landing_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  registerBlurMaskViewFactories();
  
  // Initialize API and Repositories for dependency injection
  final apiClient = ApiClient();
  final videoRepository = VideoRepositoryImpl(apiClient: apiClient);
  final authRepository = AuthRepositoryImpl(apiClient: apiClient);
  final projectRepository = ProjectRepositoryImpl();

  runApp(MyApp(
    videoRepository: videoRepository,
    authRepository: authRepository,
    projectRepository: projectRepository,
  ));
}

class MyApp extends StatelessWidget {
  final VideoRepository videoRepository;
  final AuthRepository authRepository;
  final ProjectRepository projectRepository;

  const MyApp({
    super.key,
    required this.videoRepository,
    required this.authRepository,
    required this.projectRepository,
  });

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<VideoRepository>.value(value: videoRepository),
        RepositoryProvider<AuthRepository>.value(value: authRepository),
        RepositoryProvider<ProjectRepository>.value(value: projectRepository),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider<AuthBloc>(
            create: (context) => AuthBloc(
              authRepository: context.read<AuthRepository>(),
            )..add(AppStartedEvent()),
          ),
          BlocProvider<ProjectBloc>(
            create: (context) => ProjectBloc(
              projectRepository: context.read<ProjectRepository>(),
            ),
          ),
          BlocProvider<ImportBloc>(
            create: (context) => ImportBloc(
              videoRepository: context.read<VideoRepository>(),
            ),
          ),
          BlocProvider<WorkspaceBloc>(
            create: (context) => WorkspaceBloc(),
          ),
        ],
        child: MaterialApp(
          title: 'RESUB — Auto Dubbing App',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.darkTheme,
          initialRoute: '/',
          routes: {
            '/': (context) => const LandingScreen(),
            '/dashboard': (context) => BlocBuilder<AuthBloc, AuthState>(
                  builder: (context, state) {
                    if (state is AuthLoading) {
                      return const Scaffold(
                        body: Center(
                          child: CircularProgressIndicator(color: AppColors.primary),
                        ),
                      );
                    }
                    return const ProjectDashboardScreen();
                  },
                ),
            '/login': (context) => const AuthScreen(),
            '/workspace': (context) => const WorkspaceScreen(),
          },
        ),
      ),
    );
  }
}
