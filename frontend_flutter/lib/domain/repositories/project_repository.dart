import '../../data/models/project_model.dart';

abstract class ProjectRepository {
  Future<List<ProjectModel>> getAllProjects();
  Future<void> saveProject(ProjectModel project);
  Future<void> deleteProject(String id);
  Future<void> renameProject(String id, String newName);
}
