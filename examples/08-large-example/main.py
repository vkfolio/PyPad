"""
Student Management System
A comprehensive system to manage student records, grades, and generate reports.
This is a single-file 200+ line example to test PythonPad.
"""

import sys
import json
from datetime import datetime
from collections import defaultdict


class Student:
    """Represents a student with personal and academic information."""

    def __init__(self, student_id, name, age, email):
        self.student_id = student_id
        self.name = name
        self.age = age
        self.email = email
        self.courses = {}  # course_name -> grade
        self.attendance = {}  # course_name -> percentage

    def add_grade(self, course_name, grade):
        """Add or update grade for a course."""
        if 0 <= grade <= 100:
            self.courses[course_name] = grade
            return True
        return False

    def add_attendance(self, course_name, percentage):
        """Add or update attendance for a course."""
        if 0 <= percentage <= 100:
            self.attendance[course_name] = percentage
            return True
        return False

    def get_gpa(self):
        """Calculate GPA based on grades."""
        if not self.courses:
            return 0.0

        total_points = 0
        for grade in self.courses.values():
            if grade >= 90:
                total_points += 4.0
            elif grade >= 80:
                total_points += 3.0
            elif grade >= 70:
                total_points += 2.0
            elif grade >= 60:
                total_points += 1.0
            else:
                total_points += 0.0

        return total_points / len(self.courses)

    def get_average_grade(self):
        """Calculate average grade."""
        if not self.courses:
            return 0.0
        return sum(self.courses.values()) / len(self.courses)

    def get_average_attendance(self):
        """Calculate average attendance."""
        if not self.attendance:
            return 0.0
        return sum(self.attendance.values()) / len(self.attendance)

    def to_dict(self):
        """Convert student to dictionary."""
        return {
            'student_id': self.student_id,
            'name': self.name,
            'age': self.age,
            'email': self.email,
            'courses': self.courses,
            'attendance': self.attendance,
            'gpa': round(self.get_gpa(), 2),
            'avg_grade': round(self.get_average_grade(), 2),
            'avg_attendance': round(self.get_average_attendance(), 2)
        }

    def __str__(self):
        return f"Student({self.student_id}, {self.name}, GPA: {self.get_gpa():.2f})"


class StudentManagementSystem:
    """Manages a collection of students and provides various operations."""

    def __init__(self):
        self.students = {}  # student_id -> Student
        self.courses_list = set()

    def add_student(self, student):
        """Add a student to the system."""
        self.students[student.student_id] = student
        self.courses_list.update(student.courses.keys())

    def remove_student(self, student_id):
        """Remove a student from the system."""
        if student_id in self.students:
            del self.students[student_id]
            return True
        return False

    def get_student(self, student_id):
        """Get a student by ID."""
        return self.students.get(student_id)

    def search_students_by_name(self, name):
        """Search students by name (case-insensitive partial match)."""
        results = []
        search_term = name.lower()
        for student in self.students.values():
            if search_term in student.name.lower():
                results.append(student)
        return results

    def get_top_students(self, n=5):
        """Get top N students by GPA."""
        sorted_students = sorted(
            self.students.values(),
            key=lambda s: s.get_gpa(),
            reverse=True
        )
        return sorted_students[:n]

    def get_students_by_course(self, course_name):
        """Get all students enrolled in a course."""
        results = []
        for student in self.students.values():
            if course_name in student.courses:
                results.append(student)
        return results

    def calculate_course_statistics(self, course_name):
        """Calculate statistics for a specific course."""
        grades = []
        attendance_rates = []

        for student in self.students.values():
            if course_name in student.courses:
                grades.append(student.courses[course_name])
            if course_name in student.attendance:
                attendance_rates.append(student.attendance[course_name])

        if not grades:
            return None

        return {
            'course': course_name,
            'enrolled_students': len(grades),
            'average_grade': sum(grades) / len(grades),
            'highest_grade': max(grades),
            'lowest_grade': min(grades),
            'passing_rate': len([g for g in grades if g >= 60]) / len(grades) * 100,
            'average_attendance': sum(attendance_rates) / len(attendance_rates) if attendance_rates else 0
        }

    def generate_report(self):
        """Generate a comprehensive system report."""
        print("=" * 70)
        print("STUDENT MANAGEMENT SYSTEM REPORT".center(70))
        print("=" * 70)
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total Students: {len(self.students)}")
        print(f"Total Courses: {len(self.courses_list)}")
        print("=" * 70)

        # Overall statistics
        if self.students:
            avg_gpa = sum(s.get_gpa() for s in self.students.values()) / len(self.students)
            avg_grade = sum(s.get_average_grade() for s in self.students.values()) / len(self.students)

            print(f"\nOVERALL STATISTICS:")
            print(f"  Average GPA:   {avg_gpa:.2f}")
            print(f"  Average Grade: {avg_grade:.2f}")

        # Top students
        print(f"\nTOP 5 STUDENTS BY GPA:")
        top_students = self.get_top_students(5)
        for i, student in enumerate(top_students, 1):
            print(f"  {i}. {student.name:20s} - GPA: {student.get_gpa():.2f} - Avg: {student.get_average_grade():.2f}")

        # Course statistics
        print(f"\nCOURSE STATISTICS:")
        for course in sorted(self.courses_list):
            stats = self.calculate_course_statistics(course)
            if stats:
                print(f"\n  {course}:")
                print(f"    Enrolled: {stats['enrolled_students']}")
                print(f"    Average:  {stats['average_grade']:.2f}")
                print(f"    Range:    {stats['lowest_grade']:.0f} - {stats['highest_grade']:.0f}")
                print(f"    Passing:  {stats['passing_rate']:.1f}%")
                print(f"    Attend:   {stats['average_attendance']:.1f}%")

        print("\n" + "=" * 70)


def create_sample_data():
    """Create sample student data for testing."""
    sms = StudentManagementSystem()

    # Sample students
    students_data = [
        (1001, "Alice Johnson", 20, "alice.j@email.com"),
        (1002, "Bob Smith", 21, "bob.smith@email.com"),
        (1003, "Charlie Brown", 19, "charlie.b@email.com"),
        (1004, "Diana Prince", 22, "diana.p@email.com"),
        (1005, "Eve Davis", 20, "eve.d@email.com"),
        (1006, "Frank Miller", 21, "frank.m@email.com"),
        (1007, "Grace Lee", 19, "grace.l@email.com"),
        (1008, "Henry Wilson", 22, "henry.w@email.com"),
    ]

    # Courses
    courses = ["Python Programming", "Data Structures", "Web Development", "Database Systems"]

    # Create students and add grades
    for student_id, name, age, email in students_data:
        student = Student(student_id, name, age, email)

        # Add random-ish grades (deterministic based on student_id)
        for i, course in enumerate(courses):
            # Generate grade based on student_id and course index
            base_grade = 60 + (student_id % 30)
            variation = (i * 5) - 10
            grade = min(100, max(0, base_grade + variation))
            student.add_grade(course, grade)

            # Generate attendance
            attendance = min(100, max(60, base_grade + (i * 3)))
            student.add_attendance(course, attendance)

        sms.add_student(student)

    return sms


def interactive_menu(sms):
    """Display an interactive menu."""
    while True:
        print("\n" + "=" * 50)
        print("STUDENT MANAGEMENT SYSTEM MENU".center(50))
        print("=" * 50)
        print("1. View All Students")
        print("2. Search Student by Name")
        print("3. View Student Details")
        print("4. View Top Students")
        print("5. View Course Statistics")
        print("6. Generate Full Report")
        print("7. Exit")
        print("=" * 50)

        choice = input("\nEnter your choice (1-7): ").strip()

        if choice == "1":
            print("\nALL STUDENTS:")
            for student in sorted(sms.students.values(), key=lambda s: s.student_id):
                print(f"  {student.student_id}: {student.name:20s} - GPA: {student.get_gpa():.2f}")

        elif choice == "2":
            name = input("Enter name to search: ").strip()
            results = sms.search_students_by_name(name)
            if results:
                print(f"\nFound {len(results)} student(s):")
                for student in results:
                    print(f"  {student}")
            else:
                print("No students found.")

        elif choice == "3":
            student_id = input("Enter student ID: ").strip()
            try:
                student = sms.get_student(int(student_id))
                if student:
                    print(f"\nStudent Details:")
                    print(f"  ID:          {student.student_id}")
                    print(f"  Name:        {student.name}")
                    print(f"  Age:         {student.age}")
                    print(f"  Email:       {student.email}")
                    print(f"  GPA:         {student.get_gpa():.2f}")
                    print(f"  Avg Grade:   {student.get_average_grade():.2f}")
                    print(f"  Attendance:  {student.get_average_attendance():.2f}%")
                    print(f"\n  Courses:")
                    for course, grade in student.courses.items():
                        attendance = student.attendance.get(course, 0)
                        print(f"    - {course:25s}: {grade:.0f}% (Attend: {attendance:.0f}%)")
                else:
                    print("Student not found.")
            except ValueError:
                print("Invalid student ID.")

        elif choice == "4":
            print("\nTOP 5 STUDENTS:")
            top = sms.get_top_students(5)
            for i, student in enumerate(top, 1):
                print(f"  {i}. {student.name:20s} - GPA: {student.get_gpa():.2f}")

        elif choice == "5":
            print("\nAvailable Courses:")
            for i, course in enumerate(sorted(sms.courses_list), 1):
                print(f"  {i}. {course}")
            course_name = input("\nEnter course name: ").strip()
            stats = sms.calculate_course_statistics(course_name)
            if stats:
                print(f"\n{course_name} Statistics:")
                print(f"  Enrolled:  {stats['enrolled_students']}")
                print(f"  Average:   {stats['average_grade']:.2f}")
                print(f"  Highest:   {stats['highest_grade']:.0f}")
                print(f"  Lowest:    {stats['lowest_grade']:.0f}")
                print(f"  Passing:   {stats['passing_rate']:.1f}%")
                print(f"  Attendance: {stats['average_attendance']:.1f}%")
            else:
                print("Course not found.")

        elif choice == "6":
            sms.generate_report()

        elif choice == "7":
            print("\nGoodbye!")
            break

        else:
            print("Invalid choice. Please try again.")


def main():
    """Main function."""
    print("=" * 70)
    print("STUDENT MANAGEMENT SYSTEM".center(70))
    print("A 200+ Line Python Example for PythonPad".center(70))
    print("=" * 70)

    # Create sample data
    print("\nInitializing system with sample data...")
    sms = create_sample_data()
    print(f"[OK] Loaded {len(sms.students)} students")
    print(f"[OK] Loaded {len(sms.courses_list)} courses")

    # Check for command-line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--report":
            sms.generate_report()
        elif sys.argv[1] == "--json":
            # Export to JSON
            data = {sid: student.to_dict() for sid, student in sms.students.items()}
            print(json.dumps(data, indent=2))
        else:
            print(f"Unknown argument: {sys.argv[1]}")
            print("Usage: python main.py [--report | --json]")
    else:
        # Interactive mode (simulated)
        print("\nGenerating automatic report...")
        sms.generate_report()

        print("\nTIP: In a real interactive environment, you would see a menu.")
        print("     Try running with: --report or --json arguments")


if __name__ == "__main__":
    main()
