from django.shortcuts import render
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from .forms import RegisterForm
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from . import tables_interactions as ti
from .models import Users
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

@csrf_exempt
def register(request):
	if( request.method == 'POST' ):
		try:
			form = RegisterForm(request.POST)
			if(form.is_valid()):
				form.save()
				return HttpResponse('User created successfully!', content_type='text/plain')
			#send error message
			return HttpResponseBadRequest(content=form.errors.as_text(), content_type='text/plain')
		except Exception as e:
			print(str(e))
			return HttpResponseBadRequest(content="something went wrong, please try again", content_type='text/plain')
	else:
		return HttpResponseBadRequest(content='Invalid request method!', content_type='text/plain')

@csrf_exempt
def userLogin(request):
	if( request.method == 'POST' ):
		try:
			email = request.POST['email']
			password = request.POST['password']
			#find the username associated with the unique email in the database
			user = User.objects.get(email=email)
			user = authenticate(request, username=user.username, password=password)
			if user is not None:
				login(request, user)
				return HttpResponse('User logged in successfully!', content_type='text/plain')
			else:
				return HttpResponseBadRequest(content='Invalid email or password!', content_type='text/plain')
		except Exception as e:
			print(str(e))
			return HttpResponseBadRequest(content="something went wrong, please try again", content_type='text/plain')
	else:
		return HttpResponseBadRequest(content='Invalid request method!', content_type='text/plain')


def userLogout(request):
	logout(request)
	return HttpResponse('User logged out successfully!', content_type='text/plain')

#cheks if user a user is currently logged in returns the username if so
def checkLogin(request):
	if request.user.is_authenticated:
		return HttpResponse(f'user {request.user.username} is currently logged in', content_type='text/plain')
	else:
		return HttpResponse('No user logged in', content_type='text/plain')

@api_view(['GET'])
def player_loc_stats_api(request, player_name):
    stats = ti.get_player_loc_stats(player_name)
    return Response(stats)

@api_view(['GET'])
def leaderboard(request):
    leaderboard_data = ti.get_leaderboard()
    return Response(leaderboard_data)
	
'''def player_loc_stats_api(request, player_name):
	result = ti.get_player_loc_stats(player_name)
	return JsonResponse(result)

def leaderboard(request):
    leaderboard_data = ti.get_leaderboard()
    return JsonResponse({'leaderboard': leaderboard_data})
'''

def social_log(request, mail):
    try:
        # Cerca un utente nel modello User associato a Users
        user = User.objects.get(email=mail)
        # Trova l'istanza di Users associata a questo utente
        users_instance = Users.objects.get(user=user)
        return JsonResponse({'success': True})
    except User.DoesNotExist or Users.DoesNotExist:
        # L'utente o l'istanza di Users non esiste
        return JsonResponse({'success': False})