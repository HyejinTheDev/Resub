import 'package:equatable/equatable.dart';
import '../../../data/models/project_model.dart';

abstract class ProjectState extends Equatable {
  const ProjectState();

  @override
  List<Object?> get props => [];
}

class ProjectInitial extends ProjectState {}

class ProjectLoading extends ProjectState {}

class ProjectsLoaded extends ProjectState {
  final List<ProjectModel> projects;

  const ProjectsLoaded(this.projects);

  @override
  List<Object?> get props => [projects];
}

class ProjectOperationFailure extends ProjectState {
  final String error;

  const ProjectOperationFailure(this.error);

  @override
  List<Object?> get props => [error];
}
