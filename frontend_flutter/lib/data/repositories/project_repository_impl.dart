import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/repositories/project_repository.dart';
import '../models/project_model.dart';

class ProjectRepositoryImpl implements ProjectRepository {
  static const String _projectsKey = 'resub_projects';

  // Static in-memory storage fallback for web sandboxed iframes (like Hugging Face Spaces)
  static final Map<String, String> _memStorage = {};

  @override
  Future<List<ProjectModel>> getAllProjects() async {
    String? jsonStr;
    try {
      final prefs = await SharedPreferences.getInstance();
      jsonStr = prefs.getString(_projectsKey);
    } catch (_) {
      jsonStr = _memStorage[_projectsKey];
    }

    if (jsonStr == null) return [];
    try {
      final List<dynamic> list = jsonDecode(jsonStr) as List<dynamic>;
      return list.map((json) => ProjectModel.fromJson(json as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  @override
  Future<void> saveProject(ProjectModel project) async {
    final projects = await getAllProjects();
    
    // Remove if already exists, then insert at the beginning
    projects.removeWhere((p) => p.id == project.id);
    projects.insert(0, project);
    
    final jsonStr = jsonEncode(projects.map((p) => p.toJson()).toList());
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_projectsKey, jsonStr);
    } catch (_) {}
    _memStorage[_projectsKey] = jsonStr;
  }

  @override
  Future<void> deleteProject(String id) async {
    final projects = await getAllProjects();
    projects.removeWhere((p) => p.id == id);
    
    final jsonStr = jsonEncode(projects.map((p) => p.toJson()).toList());
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_projectsKey, jsonStr);
    } catch (_) {}
    _memStorage[_projectsKey] = jsonStr;
  }

  @override
  Future<void> renameProject(String id, String newName) async {
    final projects = await getAllProjects();
    
    final index = projects.indexWhere((p) => p.id == id);
    if (index != -1) {
      final oldProj = projects[index];
      projects[index] = ProjectModel(
        id: oldProj.id,
        name: newName,
        createdAt: oldProj.createdAt,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
        subtitles: oldProj.subtitles,
        blurMasks: oldProj.blurMasks,
        subtitleStyle: oldProj.subtitleStyle,
        cropStyle: oldProj.cropStyle,
        videoTransform: oldProj.videoTransform,
        videoData: oldProj.videoData,
        storyboard: oldProj.storyboard,
      );
      final jsonStr = jsonEncode(projects.map((p) => p.toJson()).toList());
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_projectsKey, jsonStr);
      } catch (_) {}
      _memStorage[_projectsKey] = jsonStr;
    }
  }
}
