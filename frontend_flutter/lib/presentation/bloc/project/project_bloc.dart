import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../domain/repositories/project_repository.dart';
import 'project_event.dart';
import 'project_state.dart';

class ProjectBloc extends Bloc<ProjectEvent, ProjectState> {
  final ProjectRepository projectRepository;

  ProjectBloc({required this.projectRepository}) : super(ProjectInitial()) {
    on<LoadAllProjectsEvent>(_onLoadAllProjects);
    on<SaveCurrentProjectEvent>(_onSaveCurrentProject);
    on<DeleteProjectEvent>(_onDeleteProject);
    on<RenameProjectEvent>(_onRenameProject);
  }

  Future<void> _onLoadAllProjects(LoadAllProjectsEvent event, Emitter<ProjectState> emit) async {
    emit(ProjectLoading());
    try {
      final projects = await projectRepository.getAllProjects();
      emit(ProjectsLoaded(projects));
    } catch (e) {
      emit(ProjectOperationFailure(e.toString()));
    }
  }

  Future<void> _onSaveCurrentProject(SaveCurrentProjectEvent event, Emitter<ProjectState> emit) async {
    try {
      await projectRepository.saveProject(event.project);
      final projects = await projectRepository.getAllProjects();
      emit(ProjectsLoaded(projects));
    } catch (e) {
      emit(ProjectOperationFailure(e.toString()));
    }
  }

  Future<void> _onDeleteProject(DeleteProjectEvent event, Emitter<ProjectState> emit) async {
    try {
      await projectRepository.deleteProject(event.id);
      final projects = await projectRepository.getAllProjects();
      emit(ProjectsLoaded(projects));
    } catch (e) {
      emit(ProjectOperationFailure(e.toString()));
    }
  }

  Future<void> _onRenameProject(RenameProjectEvent event, Emitter<ProjectState> emit) async {
    try {
      await projectRepository.renameProject(event.id, event.newName);
      final projects = await projectRepository.getAllProjects();
      emit(ProjectsLoaded(projects));
    } catch (e) {
      emit(ProjectOperationFailure(e.toString()));
    }
  }
}
