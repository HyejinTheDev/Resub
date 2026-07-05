import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'data/repositories/video_repository_impl.dart';
import 'domain/repositories/video_repository.dart';
import 'presentation/bloc/import/import_bloc.dart';
import 'presentation/bloc/workspace/workspace_bloc.dart';
import 'presentation/screens/import/import_screen.dart';
import 'presentation/screens/workspace/workspace_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize API and Repositories for dependency injection
  final apiClient = ApiClient();
  final videoRepository = VideoRepositoryImpl(apiClient: apiClient);

  runApp(MyApp(videoRepository: videoRepository));
}

class MyApp extends StatelessWidget {
  final VideoRepository videoRepository;

  const MyApp({
    super.key,
    required this.videoRepository,
  });

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<VideoRepository>.value(value: videoRepository),
      ],
      child: MultiBlocProvider(
        providers: [
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
            '/': (context) => const ImportScreen(),
            '/workspace': (context) => const WorkspaceScreen(),
          },
        ),
      ),
    );
  }
}
