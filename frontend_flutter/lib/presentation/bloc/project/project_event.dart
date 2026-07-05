import 'package:equatable/equatable.dart';
import '../../../data/models/project_model.dart';

abstract class ProjectEvent extends Equatable {
  const ProjectEvent();

  @override
  List<Object?> get props => [];
}

class LoadAllProjectsEvent extends ProjectEvent {}

class SaveCurrentProjectEvent extends ProjectEvent {
  final ProjectModel project;

  const SaveCurrentProjectEvent(this.project);

  @override
  List<Object?> get props => [project];
}

class DeleteProjectEvent extends ProjectEvent {
  final String id;

  const DeleteProjectEvent(this.id);

  @override
  List<Object?> get props => [id];
}

class RenameProjectEvent extends ProjectEvent {
  final String id;
  final String newName;

  const RenameProjectEvent(this.id, this.newName);

  @override
  List<Object?> get props => [id, newName];
}
